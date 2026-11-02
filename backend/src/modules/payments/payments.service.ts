import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { Role } from '../../common/enums/role.enum';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Booking } from '../bookings/booking.entity';
import { BookingCharge } from '../bookings/booking-charge.entity';
import { CreatePaymentDto } from './dto';
import { PaymentPurpose, PaymentTransaction } from './payment.entity';

@Injectable()
export class PaymentsService {
  constructor(private readonly ds: DataSource) {}

  private access(user: JwtUser, booking: Booking, write = false) {
    if (write && user.role === Role.CUSTOMER) throw new ForbiddenException();
    if (user.role === Role.CUSTOMER && booking.customerId !== user.sub) throw new ForbiddenException();
    if (user.role === Role.STAFF && user.stationId !== booking.vehicle.stationId) throw new ForbiddenException();
  }

  async create(user: JwtUser, bookingId: number, dto: CreatePaymentDto) {
    return this.ds.transaction(async em => {
      const booking = await em.getRepository(Booking).findOne({
        where: { id: bookingId }, lock: { mode: 'pessimistic_write' },
      });
      if (!booking) throw new NotFoundException('Không tìm thấy đơn');
      this.access(user, booking, true);

      const repo = em.getRepository(PaymentTransaction);
      const previous = await repo.findOneBy({ idempotencyKey: dto.idempotencyKey });
      if (previous) {
        if (previous.bookingId !== bookingId || previous.purpose !== dto.purpose ||
            previous.method !== dto.method || Number(previous.amount) !== dto.amount) {
          throw new BadRequestException('Mã chống lặp đã được sử dụng cho giao dịch khác');
        }
        return previous;
      }

      if ([BookingStatus.CANCELLED, BookingStatus.EXPIRED].includes(booking.status)) {
        throw new BadRequestException('Không thể ghi nhận giao dịch cho đơn đã hủy hoặc hết hạn');
      }

      const all = await repo.findBy({ bookingId });
      const total = (purpose: PaymentPurpose) =>
        all.filter(payment => payment.purpose === purpose)
          .reduce((sum, payment) => sum + Number(payment.amount), 0);
      const amount = Math.round(dto.amount * 100) / 100;

      if (dto.purpose === PaymentPurpose.RENT) {
        const remaining = Math.round((Number(booking.rentalAmount) - total(PaymentPurpose.RENT)) * 100) / 100;
        if (amount > remaining) throw new BadRequestException('Số thu tiền thuê vượt quá số tiền thuê còn phải thu');
      }

      if (dto.purpose === PaymentPurpose.DEPOSIT) {
        const remaining = Math.round((Number(booking.depositSnapshot) - total(PaymentPurpose.DEPOSIT)) * 100) / 100;
        if (amount > remaining) throw new BadRequestException('Số tiền cọc vượt quá tiền cọc còn phải thu');
      }

      if (dto.purpose === PaymentPurpose.REFUND) {
        const depositDeductions = (await em.getRepository(BookingCharge).findBy({ bookingId, applyToDeposit: true }))
          .reduce((sum, charge) => sum + Number(charge.amount), 0);
        const refundable = Math.round((total(PaymentPurpose.DEPOSIT) - depositDeductions - total(PaymentPurpose.REFUND)) * 100) / 100;
        if (booking.status !== BookingStatus.COMPLETED) {
          throw new BadRequestException('Chỉ hoàn tiền cọc sau khi đã nhận xe trả và hoàn thành đơn');
        }
        if (amount > refundable) throw new BadRequestException('Số hoàn vượt quá tiền cọc đã nhận còn lại');
      }

      return repo.save(repo.create({
        bookingId,
        purpose: dto.purpose,
        method: dto.method,
        amount: amount.toFixed(2),
        idempotencyKey: dto.idempotencyKey,
        note: dto.note ?? null,
        recordedById: user.sub,
      }));
    });
  }

  async list(user: JwtUser, bookingId: number) {
    const booking = await this.ds.getRepository(Booking).findOneBy({ id: bookingId });
    if (!booking) throw new NotFoundException('Không tìm thấy đơn');
    this.access(user, booking);
    return this.ds.getRepository(PaymentTransaction).find({
      where: { bookingId }, order: { id: 'ASC' },
    });
  }
}
