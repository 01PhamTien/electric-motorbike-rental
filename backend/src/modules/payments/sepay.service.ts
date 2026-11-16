import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { Role } from '../../common/enums/role.enum';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Booking } from '../bookings/booking.entity';
import { PaymentMethod, PaymentPurpose, PaymentTransaction } from './payment.entity';
import { SePayPaymentAttempt, SePayAttemptStatus } from './sepay-payment-attempt.entity';
import { createSePaySignature, SePayCheckoutFields, safeSecretEquals } from './sepay-signature';

const CHECKOUT_URL = 'https://pay-sandbox.sepay.vn/v1/checkout/init';

@Injectable()
export class SePayService {
  constructor(private readonly ds: DataSource, private readonly config: ConfigService) {}

  async createCheckout(user: JwtUser, bookingId: number, purpose: PaymentPurpose.RENT | PaymentPurpose.DEPOSIT) {
    if (user.role !== Role.CUSTOMER) throw new ForbiddenException('Chỉ khách hàng mới có thể tự tạo thanh toán');
    const merchantId = this.config.get<string>('SEPAY_MERCHANT_ID');
    const secretKey = this.config.get<string>('SEPAY_SECRET_KEY');
    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    const publicApiUrl = this.config.get<string>('SEPAY_PUBLIC_URL');
    if (!merchantId || !secretKey || !frontendUrl || !publicApiUrl) {
      throw new InternalServerErrorException('SePay Sandbox chưa được cấu hình đầy đủ');
    }

    const attempt = await this.ds.transaction(async manager => {
      const bookingRepo = manager.getRepository(Booking);
      const booking = await bookingRepo.findOne({ where: { id: bookingId }, lock: { mode: 'pessimistic_write' } });
      if (!booking) throw new NotFoundException('Không tìm thấy đơn thuê');
      if (booking.customerId !== user.sub) throw new ForbiddenException();
      if ([BookingStatus.CANCELLED, BookingStatus.EXPIRED, BookingStatus.COMPLETED].includes(booking.status)) {
        throw new BadRequestException('Đơn thuê không còn đủ điều kiện thanh toán');
      }
      const paymentRepo = manager.getRepository(PaymentTransaction);
      const payments = await paymentRepo.findBy({ bookingId });
      const attempts = await manager.getRepository(SePayPaymentAttempt).find({
        where: { bookingId, purpose, status: SePayAttemptStatus.PENDING },
        order: { createdAt: 'DESC' },
      });
      const cents = (value: string | number) => Math.round(Number(value) * 100);
      const paid = payments.filter(p => p.purpose === purpose)
        .reduce((sum, p) => sum + cents(p.amount), 0);

      // A retry after a lost HTTP response must reuse the existing invoice.
      // Creating another pending invoice for the same balance could allow duplicate payment.
      if (attempts.length === 1) return attempts[0];
      if (attempts.length > 1) {
        throw new BadRequestException('Đơn thuê đang có nhiều giao dịch SePay chờ xử lý. Vui lòng liên hệ quản trị viên để đối soát trước khi thử lại.');
      }

      const target = purpose === PaymentPurpose.DEPOSIT ? cents(booking.depositSnapshot) : cents(booking.rentalAmount);
      const remaining = target - paid;
      if (!Number.isSafeInteger(remaining) || remaining <= 0) {
        throw new BadRequestException('Khoản thanh toán đã được ghi nhận đầy đủ');
      }
      const invoiceNumber = 'VG' + Date.now().toString(36).toUpperCase() + randomBytes(5).toString('hex').toUpperCase();
      return manager.getRepository(SePayPaymentAttempt).save(manager.getRepository(SePayPaymentAttempt).create({
        bookingId, invoiceNumber, providerOrderId: null, purpose,
        amount: (remaining / 100).toFixed(2), status: SePayAttemptStatus.PENDING,
        providerTransactionId: null, paidAt: null,
      }));
    });

    const returnBase = publicApiUrl.replace(/\/+$/, '');
    const fields: SePayCheckoutFields = {
      order_amount: String(Math.round(Number(attempt.amount))),
      merchant: merchantId,
      currency: 'VND',
      operation: 'PURCHASE',
      order_description: 'VoltGo ' + (purpose === PaymentPurpose.DEPOSIT ? 'tien coc' : 'tien thue') + ' don #' + bookingId,
      order_invoice_number: attempt.invoiceNumber,
      payment_method: 'BANK_TRANSFER',
      customer_id: String(user.sub),
      success_url: returnBase + '/api/payments/sepay/return?bookingId=' + bookingId + '&invoice=' + encodeURIComponent(attempt.invoiceNumber) + '&result=success',
      error_url: returnBase + '/api/payments/sepay/return?bookingId=' + bookingId + '&invoice=' + encodeURIComponent(attempt.invoiceNumber) + '&result=error',
      cancel_url: returnBase + '/api/payments/sepay/return?bookingId=' + bookingId + '&invoice=' + encodeURIComponent(attempt.invoiceNumber) + '&result=cancel',
    };
    return {
      provider: 'SEPAY',
      environment: 'SANDBOX',
      action: CHECKOUT_URL,
      method: 'POST',
      fields: { ...fields, signature: createSePaySignature(fields, secretKey) },
    };
  }

  async handleIpn(payload: any, suppliedSecret: string | undefined) {
    const ipnSecret = this.config.get<string>('SEPAY_IPN_SECRET');
    if (!ipnSecret || !safeSecretEquals(suppliedSecret, ipnSecret)) {
      throw new ForbiddenException('SePay IPN authentication failed');
    }
    if (!payload || !Number.isInteger(payload.timestamp) ||
        Math.abs(Date.now() / 1000 - payload.timestamp) > 24 * 60 * 60 ||
        !payload.order || !payload.transaction || typeof payload.order.order_invoice_number !== 'string') {
      throw new BadRequestException('SePay IPN payload is invalid or expired');
    }

    return this.ds.transaction(async manager => {
      const attempts = manager.getRepository(SePayPaymentAttempt);
      const attempt = await attempts.findOne({
        where: { invoiceNumber: payload.order.order_invoice_number },
        lock: { mode: 'pessimistic_write' },
      });
      if (!attempt) throw new NotFoundException('Không tìm thấy giao dịch SePay');
      if (payload.order.order_currency !== 'VND' || Math.round(Number(payload.order.order_amount) * 100) !== Math.round(Number(attempt.amount) * 100) ||
          Math.round(Number(payload.transaction.transaction_amount) * 100) !== Math.round(Number(attempt.amount) * 100) ||
          payload.transaction.transaction_currency !== 'VND') {
        throw new BadRequestException('Số tiền hoặc đơn vị tiền tệ từ SePay không khớp');
      }

      if (payload.notification_type === 'TRANSACTION_VOID') {
        if (attempt.status === SePayAttemptStatus.PENDING) {
          attempt.status = SePayAttemptStatus.VOID;
          await attempts.save(attempt);
        }
        return { success: true, duplicate: attempt.status !== SePayAttemptStatus.VOID };
      }
      if (payload.notification_type !== 'ORDER_PAID' || payload.order.order_status !== 'CAPTURED' ||
          payload.transaction.transaction_status !== 'APPROVED') {
        throw new BadRequestException('SePay chưa xác nhận giao dịch thành công');
      }
      if (attempt.status === SePayAttemptStatus.PAID) return { success: true, duplicate: true };
      if (attempt.status !== SePayAttemptStatus.PENDING) {
        throw new BadRequestException('Giao dịch không còn ở trạng thái chờ thanh toán');
      }

      const booking = await manager.getRepository(Booking).findOneBy({ id: attempt.bookingId });
      if (!booking) throw new NotFoundException('Không tìm thấy đơn thuê');
      const ledger = manager.getRepository(PaymentTransaction);
      const idempotencyKey = 'sepay:' + attempt.invoiceNumber;
      const existing = await ledger.findOneBy({ idempotencyKey });
      if (!existing) {
        await ledger.save(ledger.create({
          bookingId: attempt.bookingId,
          purpose: attempt.purpose,
          method: PaymentMethod.SEPAY,
          amount: attempt.amount,
          idempotencyKey,
          note: 'SePay Sandbox transaction ' + String(payload.transaction.transaction_id || ''),
          recordedById: booking.customerId,
        }));
      }
      attempt.status = SePayAttemptStatus.PAID;
      attempt.providerOrderId = String(payload.order.order_id || payload.order.id || '').slice(0, 64) || null;
      attempt.providerTransactionId = String(payload.transaction.transaction_id || '').slice(0, 32) || null;
      attempt.paidAt = new Date();
      await attempts.save(attempt);
      return { success: true, duplicate: false };
    });
  }
}
