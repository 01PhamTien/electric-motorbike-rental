import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { Role } from '../../common/enums/role.enum';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Booking } from '../bookings/booking.entity';
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
      const booking = await em.getRepository(Booking).findOne({ where: { id: bookingId }, lock: { mode: 'pessimistic_write' } });
      if (!booking) throw new NotFoundException('Không tìm thấy đơn');
      this.access(user, booking, true);
      const repo = em.getRepository(PaymentTransaction);
      const previous = await repo.findOneBy({ idempotencyKey: dto.idempotencyKey });
      if (previous) {
        if (previous.bookingId !== bookingId || previous.purpose !== dto.purpose || previous.method !== dto.method || Number(previous.amount) !== dto.amount)
          throw new BadRequestException('Mã chống lặp đã được sử dụng cho giao dịch khác');
        return previous;
      }
      if ([BookingStatus.CANCELLED, BookingStatus.EXPIRED].includes(booking.status)) throw new BadRequestException('Đơn đã bị hủy/hết hạn');
      if (dto.purpose === PaymentPurpose.REFUND) {
        const all = await repo.findBy({ bookingId });
        const paidDeposit = all.filter(p => p.purpose === PaymentPurpose.DEPOSIT).reduce((s,p) => s + Number(p.amount), 0);
        const refunded = all.filter(p => p.purpose === PaymentPurpose.REFUND).reduce((s,p) => s + Number(p.amount), 0);
        if (dto.amount > Math.round((paidDeposit - refunded) * 100) / 100)
          throw new BadRequestException('Số hoàn vượt quá số tiền cọc còn lại');
        if (booking.status !== BookingStatus.COMPLETED) throw new BadRequestException('Chỉ hoàn cọc sau khi trả xe');
      }
      return repo.save(repo.create({ bookingId, purpose: dto.purpose, method: dto.method,
        amount: dto.amount.toFixed(2), idempotencyKey: dto.idempotencyKey, note: dto.note ?? null, recordedById: user.sub }));
    });
  }
  async list(user: JwtUser, bookingId: number) {
    const booking = await this.ds.getRepository(Booking).findOneBy({ id: bookingId });
    if (!booking) throw new NotFoundException('Không tìm thấy đơn');
    this.access(user, booking);
    return this.ds.getRepository(PaymentTransaction).find({ where: { bookingId }, order: { id: 'ASC' } });
  }
}
