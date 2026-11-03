import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
      return bookingRepo.findOne({ where: { id: booking.id } });
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
    if (result.isExpired) throw new BadRequestException('Đơn đã hết thời hạn giữ chỗ');
    return result.saved;
  }

  private assertAccess(current: JwtUser, booking: Booking) {
    if (current.role === Role.CUSTOMER && booking.customerId !== current.sub) throw new ForbiddenException();
    if (current.role === Role.STAFF && current.stationId !== booking.vehicle.stationId) throw new ForbiddenException();
  }
}
