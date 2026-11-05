import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Role } from '../../common/enums/role.enum';
import { VehicleStatus } from '../../common/enums/vehicle-status.enum';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { Vehicle } from '../vehicles/vehicle.entity';
import { BookingStatusHistory } from './booking-status-history.entity';
import { Booking } from './booking.entity';
import { MaintenanceRecord, MaintenanceStatus } from '../maintenance/maintenance.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { CancelBookingDto, CreateBookingDto } from './dto';

@Injectable()
export class BookingsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly audit?: AuditService,
  ) {}

  async create(current: JwtUser, dto: CreateBookingDto) {
    const pickupAt = new Date(dto.pickupAt);
    const returnAt = new Date(dto.returnAt);
    if (!(returnAt > pickupAt)) throw new BadRequestException('Thời gian trả phải sau thời gian nhận');
    if (pickupAt <= new Date()) throw new BadRequestException('Thời gian nhận xe phải ở tương lai');

    return this.dataSource.transaction(async (manager) => {
      const vehicleRepo = manager.getRepository(Vehicle);
      const bookingRepo = manager.getRepository(Booking);
      const historyRepo = manager.getRepository(BookingStatusHistory);

      const vehicle = await vehicleRepo.findOne({ where: { id: dto.vehicleId, isActive: true }, lock: { mode: 'pessimistic_write' } });
      if (!vehicle) throw new NotFoundException('Không tìm thấy xe');
      if (vehicle.status !== VehicleStatus.ACTIVE) throw new BadRequestException('Xe hiện không thể đặt');
      if (!vehicle.station || !vehicle.station.isActive) throw new BadRequestException('Trạm nhận xe hiện không hoạt động. Vui lòng chọn trạm khác.');

      // Release expired holds while holding the vehicle row lock, so another
      // booking request cannot race with the cleanup for this vehicle.
      const now = new Date();
      const expiredHolds = await bookingRepo
        .createQueryBuilder('b')
        .where('b.vehicleId = :vehicleId', { vehicleId: vehicle.id })
        .andWhere('b.status = :status', { status: BookingStatus.PENDING })
        .andWhere('b.holdExpiresAt IS NOT NULL AND b.holdExpiresAt <= :now', { now })
        .getMany();

      for (const hold of expiredHolds) {
        hold.status = BookingStatus.EXPIRED;
        await bookingRepo.save(hold);
        await historyRepo.save(historyRepo.create({
          bookingId: hold.id,
          fromStatus: BookingStatus.PENDING,
          toStatus: BookingStatus.EXPIRED,
          performedById: null,
          reason: 'Tự động hết hạn giữ chỗ khi kiểm tra lịch xe',
        }));
      }

      const overlapping = await bookingRepo
        .createQueryBuilder('b')
        .setLock('pessimistic_write')
        .where('b.vehicleId = :vehicleId', { vehicleId: dto.vehicleId })
        .andWhere('b.status IN (:...statuses)', { statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.RENTING] })
        .andWhere('b.pickupAt < :returnAt AND b.returnAt > :pickupAt', { pickupAt, returnAt })
        .getOne();
      if (overlapping) throw new BadRequestException('Xe đã có lịch trong khoảng thời gian này');

      const diffMs = returnAt.getTime() - pickupAt.getTime();
      const rentalDays = Math.ceil(diffMs / 86_400_000);
      const rate = Number(vehicle.dailyRate);
      const rentalAmount = rentalDays * rate;
      const holdMinutes = Number(this.config.get('BOOKING_HOLD_MINUTES') || 15);
      const holdExpiresAt = new Date(Date.now() + holdMinutes * 60_000);

      const booking = await bookingRepo.save(bookingRepo.create({
        customerId: current.sub,
        vehicleId: vehicle.id,
        pickupAt,
        returnAt,
        dailyRateSnapshot: vehicle.dailyRate,
        depositSnapshot: vehicle.depositAmount,
        rentalAmount: String(rentalAmount),
        holdExpiresAt,
        status: BookingStatus.PENDING,
      }));

      await historyRepo.save(historyRepo.create({
        bookingId: booking.id,
        fromStatus: BookingStatus.PENDING,
        toStatus: BookingStatus.PENDING,
        performedById: current.sub,
        reason: 'Tạo đơn thuê',
      }));
      const created = await bookingRepo.findOne({ where: { id: booking.id } });
      await this.audit?.record(current.sub, 'BOOKING_CREATED', 'BOOKING', booking.id, { status: booking.status, vehicleId: vehicle.id });
      await this.notifications?.create(current.sub, 'BOOKING_CREATED', 'Đặt xe thành công', 'Đơn thuê #' + booking.id + ' đã được tạo và đang chờ xác nhận.', booking.id);
      return created;
    });
  }


  async listCalendar(current: JwtUser, fromInput: string, toInput: string) {
    if (![Role.ADMIN, Role.STAFF].includes(current.role)) throw new ForbiddenException();
    if (current.role === Role.STAFF && current.stationId == null) throw new ForbiddenException('Nhân viên chưa được phân công trạm');
    const datePattern = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
    if (!datePattern.test(fromInput) || !datePattern.test(toInput)) {
      throw new BadRequestException('Ngày bắt đầu và kết thúc phải theo định dạng YYYY-MM-DD');
    }
    const parseDate = (value: string, endOfDay = false) => {
      const [year, month, day] = value.split('-').map(Number);
      const date = new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
      return date;
    };
    const from = parseDate(fromInput);
    const to = parseDate(toInput, true);
    if (!from || !to || to < from) {
      throw new BadRequestException('Khoảng thời gian lịch không hợp lệ');
    }
    if (to.getTime() - from.getTime() > 31 * 86_400_000) {
      throw new BadRequestException('Mỗi lần chỉ xem lịch tối đa 31 ngày');
    }

    const bookingQb = this.bookingRepo.createQueryBuilder('b')
      .leftJoinAndSelect('b.vehicle', 'vehicle')
      .leftJoinAndSelect('vehicle.station', 'station')
      .leftJoinAndSelect('vehicle.model', 'model')
      .leftJoinAndSelect('b.customer', 'customer')
      .where('b.pickupAt <= :to AND b.returnAt >= :from', { from, to })
      .andWhere('b.status IN (:...statuses)', { statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.RENTING] })
      .orderBy('b.pickupAt', 'ASC');
    if (current.role === Role.STAFF) bookingQb.andWhere('vehicle.stationId = :stationId', { stationId: current.stationId });
    const bookings = await bookingQb.getMany();

    const maintenanceRepo = this.bookingRepo.manager.getRepository(MaintenanceRecord);
    const maintenanceQb = maintenanceRepo.createQueryBuilder('m')
      .innerJoin('vehicles', 'v', 'v.id = m.vehicleId')
      .leftJoin('stations', 'st', 'st.id = v.stationId')
      .leftJoin('vehicle_models', 'vm', 'vm.id = v.modelId')
      .select('m.id', 'id')
      .addSelect('m.vehicleId', 'vehicleId')
      .addSelect('m.reason', 'reason')
      .addSelect('m.status', 'status')
      .addSelect('m.scheduledAt', 'scheduledAt')
      .addSelect('m.completedAt', 'completedAt')
      .addSelect('v.code', 'vehicleCode')
      .addSelect('st.name', 'stationName')
      .addSelect('vm.brand', 'brand')
      .addSelect('vm.name', 'modelName')
      .where('m.scheduledAt >= :from AND m.scheduledAt <= :to', { from, to })
      .andWhere('m.status IN (:...statuses)', { statuses: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS] })
      .orderBy('m.scheduledAt', 'ASC');
    if (current.role === Role.STAFF) maintenanceQb.andWhere('v.stationId = :stationId', { stationId: current.stationId });
    const maintenance = await maintenanceQb.getRawMany();

    return [
      ...bookings.map(b => ({
        type: 'BOOKING' as const, id: b.id, vehicleId: b.vehicleId,
        vehicleCode: b.vehicle?.code ?? '', model: b.vehicle?.model?.brand + ' ' + b.vehicle?.model?.name,
        stationName: b.vehicle?.station?.name ?? '', customerName: b.customer?.fullName ?? '',
        title: 'Đơn thuê #' + b.id, status: b.status, start: b.pickupAt, end: b.returnAt,
      })),
      ...maintenance.map(m => ({
        type: 'MAINTENANCE' as const, id: m.id, vehicleId: m.vehicleId,
        vehicleCode: m.vehicleCode ?? '',
        model: [m.brand, m.modelName].filter(Boolean).join(' '),
        stationName: m.stationName ?? '',
        customerName: '', title: m.reason, status: m.status, start: m.scheduledAt, end: m.completedAt,
      })),
    ].sort((a, b) => (a.start instanceof Date ? a.start.getTime() : new Date(a.start).getTime()) - (b.start instanceof Date ? b.start.getTime() : new Date(b.start).getTime()));
  }

  async listForOperations(current: JwtUser) {
    if (![Role.ADMIN, Role.STAFF].includes(current.role)) throw new ForbiddenException();
    if (current.role === Role.STAFF && current.stationId == null) throw new ForbiddenException('Nhân viên chưa được phân công trạm');
    return this.bookingRepo.find({
      where: current.role === Role.STAFF ? { vehicle: { stationId: current.stationId! } } : {},
      order: { id: 'DESC' },
      take: 100,
    });
  }

  myBookings(current: JwtUser) {
    return this.bookingRepo.find({ where: { customerId: current.sub }, order: { id: 'DESC' } });
  }

  async findOne(current: JwtUser, id: number) {
    const booking = await this.bookingRepo.findOne({ where: { id } });
    if (!booking) throw new NotFoundException('Không tìm thấy đơn thuê');
    this.assertAccess(current, booking);
    return booking;
  }

  async confirm(current: JwtUser, id: number) {
    return this.changeStatus(current, id, BookingStatus.PENDING, BookingStatus.CONFIRMED, 'Xác nhận đơn');
  }

  async cancel(current: JwtUser, id: number, dto: CancelBookingDto) {
    return this.transition(current, id, [BookingStatus.PENDING, BookingStatus.CONFIRMED],
      BookingStatus.CANCELLED, dto.reason || 'Hủy đơn', dto.reason || null);
  }

  private async changeStatus(current: JwtUser, id: number, expected: BookingStatus, next: BookingStatus, reason: string) {
    if (![Role.ADMIN, Role.STAFF].includes(current.role)) throw new ForbiddenException();
    return this.transition(current, id, [expected], next, reason);
  }

  private async transition(
    current: JwtUser,
    id: number,
    expected: BookingStatus[],
    next: BookingStatus,
    reason: string,
    cancelReason?: string | null,
  ) {
    // All booking writers acquire the vehicle lock first, matching create().
    // This serializes booking transitions with expiry cleanup and availability checks.
    // Reading the vehicle ID here is only a hint; the locked booking is rechecked below.
    const candidate = await this.bookingRepo.findOne({ where: { id } });
    if (!candidate) throw new NotFoundException('Không tìm thấy đơn thuê');

    const result = await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Vehicle).findOne({
        where: { id: candidate.vehicleId },
        lock: { mode: 'pessimistic_write' },
      });
      const bookings = manager.getRepository(Booking);
      const booking = await bookings.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!booking) throw new NotFoundException('Không tìm thấy đơn thuê');
      this.assertAccess(current, booking);
      if (!expected.includes(booking.status)) {
        throw new BadRequestException('Trạng thái hiện tại không cho phép thao tác này');
      }

      // Do not throw from inside the transaction after writing an expiry:
      // an exception would roll back the recorded EXPIRED status.
      const isExpired = booking.status === BookingStatus.PENDING
        && booking.holdExpiresAt !== null
        && booking.holdExpiresAt <= new Date();
      const fromStatus = booking.status;
      booking.status = isExpired ? BookingStatus.EXPIRED : next;
      if (!isExpired && next === BookingStatus.CANCELLED) {
        booking.cancelReason = cancelReason ?? null;
      }
      const saved = await bookings.save(booking);
      await manager.getRepository(BookingStatusHistory).save({
        bookingId: id,
        fromStatus,
        toStatus: booking.status,
        performedById: current.sub,
        reason: isExpired ? 'Hết thời hạn giữ chỗ' : reason,
      });
      return { saved, isExpired };
    });
    const statusText: Record<BookingStatus, string> = {
      [BookingStatus.PENDING]: 'đang chờ xác nhận', [BookingStatus.CONFIRMED]: 'đã được xác nhận',
      [BookingStatus.RENTING]: 'đang thuê', [BookingStatus.COMPLETED]: 'đã hoàn tất',
      [BookingStatus.CANCELLED]: 'đã bị hủy', [BookingStatus.EXPIRED]: 'đã hết thời hạn giữ chỗ',
    };
    await this.audit?.record(current.sub, 'BOOKING_STATUS_CHANGED', 'BOOKING', id, { status: result.saved.status, expired: result.isExpired });
    await this.notifications?.create(result.saved.customerId, 'BOOKING_STATUS', 'Cập nhật đơn thuê', 'Đơn thuê #' + id + ' ' + statusText[result.saved.status] + '.', id);
    if (result.isExpired) throw new BadRequestException('Đơn đã hết thời hạn giữ chỗ');
    return result.saved;
  }

  private assertAccess(current: JwtUser, booking: Booking) {
    if (current.role === Role.CUSTOMER && booking.customerId !== current.sub) throw new ForbiddenException();
    if (current.role === Role.STAFF && current.stationId !== booking.vehicle.stationId) throw new ForbiddenException();
  }
}
