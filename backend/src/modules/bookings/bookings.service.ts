import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Role } from '../../common/enums/role.enum';
import { VehicleStatus } from '../../common/enums/vehicle-status.enum';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { Vehicle } from '../vehicles/vehicle.entity';
import { MaintenanceRecord, MaintenanceStatus } from '../maintenance/maintenance.entity';
import { BookingStatusHistory } from './booking-status-history.entity';
import { BookingCharge } from './booking-charge.entity';
import { CreateBookingChargeDto } from './booking-charge.dto';
import { Booking } from './booking.entity';
import { CancelBookingDto, CreateBookingDto } from './dto';

@Injectable()
export class BookingsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
  ) {}

  async create(current: JwtUser, dto: CreateBookingDto) {
    const pickupAt = new Date(dto.pickupAt);
    const returnAt = new Date(dto.returnAt);
    if (!(returnAt > pickupAt)) throw new BadRequestException('Thời gian trả phải sau thời gian nhận');

    return this.dataSource.transaction(async (manager) => {
      const vehicleRepo = manager.getRepository(Vehicle);
      const bookingRepo = manager.getRepository(Booking);
      const historyRepo = manager.getRepository(BookingStatusHistory);

      const vehicle = await vehicleRepo.findOne({ where: { id: dto.vehicleId, isActive: true }, lock: { mode: 'pessimistic_write' } });
      if (!vehicle) throw new NotFoundException('Không tìm thấy xe');
      if (vehicle.status !== VehicleStatus.ACTIVE) throw new BadRequestException('Xe hiện không thể đặt');

      // Maintenance records in SCHEDULED or IN_PROGRESS reserve the vehicle.
      // The current maintenance specification has a single scheduledAt timestamp,
      // not a maintenance end time; therefore an open record blocks new bookings
      // until it is completed or cancelled.
      const openMaintenance = await manager.getRepository(MaintenanceRecord).findOne({
        where: {
          vehicleId: vehicle.id,
          status: In([MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS]),
        },
        select: { id: true, status: true, scheduledAt: true },
      });
      if (openMaintenance) {
        throw new BadRequestException('Xe đang có phiếu bảo dưỡng chưa kết thúc, không thể đặt thuê');
      }

      const overlapping = await bookingRepo
        .createQueryBuilder('b')
        .setLock('pessimistic_write')
        .where('b.vehicleId = :vehicleId', { vehicleId: dto.vehicleId })
        .andWhere('b.status IN (:...statuses)', { statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.RENTING] })
        // A PENDING booking stops blocking the vehicle once its configured hold expires.
        .andWhere('(b.status != :pendingStatus OR b.holdExpiresAt IS NULL OR b.holdExpiresAt > :now)', {
          pendingStatus: BookingStatus.PENDING,
          now: new Date(),
        })
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
      return bookingRepo.findOne({ where: { id: booking.id } });
    });
  }

  async addCharge(current: JwtUser, id: number, dto: CreateBookingChargeDto) {
    if (![Role.ADMIN, Role.STAFF].includes(current.role)) throw new ForbiddenException();
    return this.dataSource.transaction(async manager => {
      const booking = await manager.getRepository(Booking).findOne({
        where: { id }, lock: { mode: 'pessimistic_write' },
      });
      if (!booking) throw new NotFoundException('Không tìm thấy đơn thuê');
      this.assertAccess(current, booking);
      if (booking.status !== BookingStatus.COMPLETED) {
        throw new BadRequestException('Chỉ được quyết toán phụ phí sau khi đã nhận xe trả');
      }
      return manager.getRepository(BookingCharge).save(manager.getRepository(BookingCharge).create({
        bookingId: id, category: dto.category.trim().toUpperCase(),
        amount: (Math.round(dto.amount * 100) / 100).toFixed(2),
        applyToDeposit: dto.applyToDeposit, reason: dto.reason.trim(), createdById: current.sub,
      }));
    });
  }

  async listCharges(current: JwtUser, id: number) {
    const booking = await this.bookingRepo.findOne({ where: { id } });
    if (!booking) throw new NotFoundException('Không tìm thấy đơn thuê');
    this.assertAccess(current, booking);
    return this.dataSource.getRepository(BookingCharge).find({ where: { bookingId: id }, order: { id: 'ASC' } });
  }

  async operationsQueue(current: JwtUser) {
    if (![Role.ADMIN, Role.STAFF].includes(current.role)) throw new ForbiddenException();
    const query = this.bookingRepo.createQueryBuilder('booking')
      .leftJoinAndSelect('booking.vehicle', 'vehicle')
      .leftJoinAndSelect('vehicle.station', 'station')
      .leftJoinAndSelect('vehicle.model', 'model')
      .leftJoinAndSelect('booking.customer', 'customer')
      .orderBy('booking.pickupAt', 'ASC');
    if (current.role === Role.STAFF) {
      if (!current.stationId) throw new ForbiddenException('Tài khoản chưa được phân công điểm thuê');
      query.andWhere('vehicle.stationId = :stationId', { stationId: current.stationId });
    }
    return query.getMany();
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
    if (![Role.ADMIN, Role.STAFF, Role.CUSTOMER].includes(current.role)) throw new ForbiddenException();
    const result = await this.dataSource.transaction(async manager => {
      const bookingRepo = manager.getRepository(Booking);
      const historyRepo = manager.getRepository(BookingStatusHistory);
      const booking = await bookingRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!booking) throw new NotFoundException('Không tìm thấy đơn thuê');
      this.assertAccess(current, booking);
      if (current.role === Role.STAFF && current.stationId !== booking.vehicle.stationId) {
        throw new ForbiddenException('Không được xử lý đơn ngoài điểm được phân công');
      }
      if (![BookingStatus.PENDING, BookingStatus.CONFIRMED].includes(booking.status)) {
        throw new BadRequestException('Chỉ được hủy đơn đang chờ hoặc đã xác nhận');
      }

      const fromStatus = booking.status;
      booking.status = BookingStatus.CANCELLED;
      booking.cancelReason = dto.reason?.trim() || null;
      const saved = await bookingRepo.save(booking);
      await historyRepo.save(historyRepo.create({
        bookingId: id,
        fromStatus,
        toStatus: BookingStatus.CANCELLED,
        performedById: current.sub,
        reason: dto.reason?.trim() || 'Hủy đơn',
      }));
      return saved;
    });
    return result;
  }

  async statusHistory(current: JwtUser, id: number) {
    const booking = await this.bookingRepo.findOne({ where: { id } });
    if (!booking) throw new NotFoundException('Không tìm thấy đơn thuê');
    this.assertAccess(current, booking);
    return this.dataSource.getRepository(BookingStatusHistory).find({
      where: { bookingId: id },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  private async changeStatus(current: JwtUser, id: number, expected: BookingStatus, next: BookingStatus, reason: string) {
    if (![Role.ADMIN, Role.STAFF].includes(current.role)) throw new ForbiddenException();
    const result = await this.dataSource.transaction(async manager => {
      const bookingRepo = manager.getRepository(Booking);
      const historyRepo = manager.getRepository(BookingStatusHistory);
      const booking = await bookingRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!booking) throw new NotFoundException('Không tìm thấy đơn thuê');
      this.assertAccess(current, booking);
      if (current.role === Role.STAFF && current.stationId !== booking.vehicle.stationId) {
        throw new ForbiddenException('Không được xử lý đơn ngoài điểm được phân công');
      }
      if (booking.status !== expected) {
        throw new BadRequestException(`Đơn phải ở trạng thái ${expected}`);
      }

      if (booking.status === BookingStatus.PENDING && booking.holdExpiresAt && booking.holdExpiresAt <= new Date()) {
        booking.status = BookingStatus.EXPIRED;
        await bookingRepo.save(booking);
        await historyRepo.save(historyRepo.create({
          bookingId: id,
          fromStatus: BookingStatus.PENDING,
          toStatus: BookingStatus.EXPIRED,
          performedById: current.sub,
          reason: 'Hết thời hạn giữ chỗ trước khi xác nhận',
        }));
        return { expired: true as const };
      }

      const fromStatus = booking.status;
      booking.status = next;
      const saved = await bookingRepo.save(booking);
      await historyRepo.save(historyRepo.create({
        bookingId: id,
        fromStatus,
        toStatus: next,
        performedById: current.sub,
        reason,
      }));
      return { expired: false as const, booking: saved };
    });

    if (result.expired) {
      throw new BadRequestException('Đơn đã hết thời hạn giữ chỗ và được chuyển sang EXPIRED');
    }
    return result.booking;
  }

  private assertAccess(current: JwtUser, booking: Booking) {
    if (current.role === Role.CUSTOMER && booking.customerId !== current.sub) throw new ForbiddenException();
    if (current.role === Role.STAFF && current.stationId !== booking.vehicle.stationId) throw new ForbiddenException();
  }
}
