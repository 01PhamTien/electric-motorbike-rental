import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { Role } from '../../common/enums/role.enum';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Booking } from '../bookings/booking.entity';
import { BookingCharge } from '../bookings/booking-charge.entity';
import { CreatePaymentDto } from './dto';
import { PaymentPurpose, PaymentTransaction } from './payment.entity';
import { calculateRefundableDepositCents } from './refund-policy';
@Injectable()
export class PaymentsService {
  constructor(private readonly ds: DataSource) {}
  private access(user: JwtUser, booking: Booking, write = false) {
    if (write && user.role === Role.CUSTOMER) throw new ForbiddenException();
    if (user.role === Role.CUSTOMER && booking.customerId !== user.sub) throw new ForbiddenException();
    if (user.role === Role.STAFF && user.stationId !== booking.vehicle.stationId) throw new ForbiddenException();
  }
  async create(user: JwtUser, bookingId: number, dto: CreatePaymentDto) {
    const idempotencyKey = typeof dto.idempotencyKey === 'string' ? dto.idempotencyKey.trim() : '';
    if (!idempotencyKey) throw new BadRequestException('Mã chống lặp giao dịch không được để trống');
    return this.ds.transaction(async em => {
      const booking = await em.getRepository(Booking).findOne({ where: { id: bookingId }, lock: { mode: 'pessimistic_write' } });
      if (!booking) throw new NotFoundException('Không tìm thấy đơn');
      this.access(user, booking, true);
      const repo = em.getRepository(PaymentTransaction);
      const previous = await repo.findOneBy({ idempotencyKey });
      if (previous) {
        if (previous.bookingId !== bookingId || previous.purpose !== dto.purpose || previous.method !== dto.method || Number(previous.amount) !== dto.amount)
          throw new BadRequestException('Mã chống lặp đã được sử dụng cho giao dịch khác');
        return previous;
      }
      if ([BookingStatus.CANCELLED, BookingStatus.EXPIRED].includes(booking.status) && dto.purpose !== PaymentPurpose.REFUND)
        throw new BadRequestException('Không thể ghi nhận khoản thu mới cho đơn đã hủy/hết hạn');
      const all = await repo.findBy({ bookingId });
      const cents = (value: string | number) => Math.round(Number(value) * 100);
      const recorded = (purpose: PaymentPurpose) => all
        .filter(payment => payment.purpose === purpose)
        .reduce((sum, payment) => sum + cents(payment.amount), 0);
      const requestedCents = cents(dto.amount);

      if (dto.purpose === PaymentPurpose.RENT && recorded(PaymentPurpose.RENT) + requestedCents > cents(booking.rentalAmount))
        throw new BadRequestException('Tổng tiền thuê đã ghi nhận không được vượt quá tiền thuê của đơn');
      if (dto.purpose === PaymentPurpose.DEPOSIT && recorded(PaymentPurpose.DEPOSIT) + requestedCents > cents(booking.depositSnapshot))
        throw new BadRequestException('Tổng tiền cọc đã ghi nhận không được vượt quá tiền cọc của đơn');
      if (dto.purpose === PaymentPurpose.EXTRA) {
        if (booking.status !== BookingStatus.COMPLETED) throw new BadRequestException('Chỉ thu phụ phí sau khi đơn đã hoàn thành');
        const charges = await em.getRepository(BookingCharge).findBy({ bookingId, applyToDeposit: false });
        const chargeTotal = charges.reduce((sum, charge) => sum + cents(charge.amount), 0);
        if (recorded(PaymentPurpose.EXTRA) + requestedCents > chargeTotal) throw new BadRequestException('Số thu phụ phí vượt quá tổng phụ phí chưa thanh toán');
      }

      if (dto.purpose === PaymentPurpose.REFUND) {
        const refundableCents = calculateRefundableDepositCents({
          bookingStatus: booking.status,
          recordedDepositCents: recorded(PaymentPurpose.DEPOSIT),
          recordedRefundCents: recorded(PaymentPurpose.REFUND),
          cancellationFeeCents: cents(booking.cancellationFeeAmount ?? 0) + (await em.getRepository(BookingCharge).findBy({ bookingId, applyToDeposit: true })).reduce((sum, charge) => sum + cents(charge.amount), 0),
        });
        if (requestedCents > refundableCents)
          throw new BadRequestException('Số hoàn vượt quá tiền cọc sau khi trừ các khoản đã hoàn và phí hủy đơn');
      }
      return repo.save(repo.create({ bookingId, purpose: dto.purpose, method: dto.method,
        amount: dto.amount.toFixed(2), idempotencyKey, note: dto.note ?? null, recordedById: user.sub }));
    });
  }
  async settlementSummary(user: JwtUser, bookingId: number) {
    const booking = await this.ds.getRepository(Booking).findOne({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Không tìm thấy đơn');
    this.access(user, booking);
    const [payments, charges] = await Promise.all([
      this.ds.getRepository(PaymentTransaction).find({ where: { bookingId } }),
      this.ds.getRepository(BookingCharge).find({ where: { bookingId } }),
    ]);
    const rounded = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
    const paid = (purpose: PaymentPurpose) => rounded(payments.filter(p => p.purpose === purpose).reduce((sum,p) => sum + Number(p.amount),0));
    const rentCollected = paid(PaymentPurpose.RENT), depositCollected = paid(PaymentPurpose.DEPOSIT), extraCollected = paid(PaymentPurpose.EXTRA), refunded = paid(PaymentPurpose.REFUND);
    const deductions = rounded(charges.filter(c => c.applyToDeposit).reduce((sum,c) => sum + Number(c.amount),0));
    const separatelyBillable = rounded(charges.filter(c => !c.applyToDeposit).reduce((sum,c) => sum + Number(c.amount),0));
    const refundable = rounded(Math.max(0, depositCollected - deductions - refunded));
    return {
      bookingId, status: booking.status, currency: 'VND',
      rental: { amountDue: rounded(Number(booking.rentalAmount)), collected: rentCollected, outstanding: rounded(Math.max(0, Number(booking.rentalAmount)-rentCollected)) },
      deposit: { amountExpected: rounded(Number(booking.depositSnapshot)), collected: depositCollected, deductions, refunded, refundable, deductionExceedsCollected: deductions > depositCollected },
      extras: { separatelyBillable, collected: extraCollected, outstanding: rounded(Math.max(0,separatelyBillable-extraCollected)), deductedFromDeposit: deductions },
      cashFlow: { totalCollected: rounded(rentCollected+depositCollected+extraCollected), totalRefunded: refunded, net: rounded(rentCollected+depositCollected+extraCollected-refunded) },
      canRefundDeposit: booking.status === BookingStatus.COMPLETED && refundable > 0,
    };
  }

  async list(user: JwtUser, bookingId: number) {
    const booking = await this.ds.getRepository(Booking).findOneBy({ id: bookingId });
    if (!booking) throw new NotFoundException('Không tìm thấy đơn');
    this.access(user, booking);
    return this.ds.getRepository(PaymentTransaction).find({ where: { bookingId }, order: { id: 'ASC' } });
  }
}
