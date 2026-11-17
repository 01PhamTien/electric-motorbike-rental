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
import { calculateCombinedBookingAllocation } from './sepay-settlement';

const CHECKOUT_URLS = {
  sandbox: 'https://pay-sandbox.sepay.vn/v1/checkout/init',
  production: 'https://pay.sepay.vn/v1/checkout/init',
} as const;

@Injectable()
export class SePayService {
  constructor(private readonly ds: DataSource, private readonly config: ConfigService) {}

  async createCheckout(user: JwtUser, bookingId: number, purpose: PaymentPurpose.RENT | PaymentPurpose.DEPOSIT | 'BOOKING') {
    if (user.role !== Role.CUSTOMER) throw new ForbiddenException('Chỉ khách hàng mới có thể tự tạo thanh toán');
    const environment = (this.config.get<string>('SEPAY_ENV') || 'sandbox').toLowerCase();
    if (environment !== 'sandbox' && environment !== 'production') {
      throw new InternalServerErrorException('SEPAY_ENV chỉ nhận sandbox hoặc production');
    }
    const merchantId = this.config.get<string>('SEPAY_MERCHANT_ID_' + environment.toUpperCase())
      || (environment === 'sandbox' ? this.config.get<string>('SEPAY_MERCHANT_ID') : undefined);
    const secretKey = this.config.get<string>('SEPAY_SECRET_KEY_' + environment.toUpperCase())
      || (environment === 'sandbox' ? this.config.get<string>('SEPAY_SECRET_KEY') : undefined);
    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    const publicApiUrl = this.config.get<string>('SEPAY_PUBLIC_URL');
    const missingConfig = [
      !merchantId ? 'SEPAY_MERCHANT_ID_' + environment.toUpperCase() : null,
      !secretKey ? 'SEPAY_SECRET_KEY_' + environment.toUpperCase() : null,
      !frontendUrl ? 'FRONTEND_URL' : null,
      !publicApiUrl ? 'SEPAY_PUBLIC_URL' : null,
    ].filter((name): name is string => Boolean(name));
    if (missingConfig.length) {
      throw new InternalServerErrorException(
        'SePay ' + environment.toUpperCase() + ' chưa được cấu hình đầy đủ. Thiếu: ' + missingConfig.join(', '),
      );
    }
    if (!merchantId || !secretKey || !frontendUrl || !publicApiUrl) {
      throw new InternalServerErrorException('SePay checkout configuration is incomplete');
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
      const attemptRepo = manager.getRepository(SePayPaymentAttempt);
      const pending = await attemptRepo.find({
        where: { bookingId, status: SePayAttemptStatus.PENDING },
        order: { createdAt: 'DESC' },
      });
      // Never create a second invoice while another invoice for this booking is awaiting IPN.
      // Retries of the exact same checkout reuse its invoice after a lost browser response.
      if (pending.length === 1 && pending[0].purpose === purpose) return pending[0];
      if (pending.length > 0) {
        throw new BadRequestException('Đơn thuê đang có giao dịch SePay chờ xử lý. Vui lòng đợi kết quả hoặc liên hệ hỗ trợ trước khi tạo hóa đơn mới.');
      }

      const cents = (value: string | number) => Math.round(Number(value) * 100);
      const collected = (paymentPurpose: PaymentPurpose.RENT | PaymentPurpose.DEPOSIT) =>
        payments.filter(p => p.purpose === paymentPurpose)
          .reduce((sum, p) => sum + cents(p.amount), 0);
      let amountCents: number;
      let rentAmount: string | null = null;
      let depositAmount: string | null = null;

      if (purpose === 'BOOKING') {
        const allocation = calculateCombinedBookingAllocation(booking.rentalAmount, booking.depositSnapshot, payments);
        amountCents = allocation.totalAmountCents;
        if (amountCents <= 0) throw new BadRequestException('Tiền thuê và tiền cọc đã được ghi nhận đầy đủ');
        rentAmount = allocation.rentAmount;
        depositAmount = allocation.depositAmount;
      } else {
        const target = purpose === PaymentPurpose.DEPOSIT ? cents(booking.depositSnapshot) : cents(booking.rentalAmount);
        amountCents = target - collected(purpose);
        if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
          throw new BadRequestException('Khoản thanh toán đã được ghi nhận đầy đủ');
        }
      }

      const invoiceNumber = 'VG' + Date.now().toString(36).toUpperCase() + randomBytes(5).toString('hex').toUpperCase();
      return attemptRepo.save(attemptRepo.create({
        bookingId, invoiceNumber, providerOrderId: null, purpose,
        amount: (amountCents / 100).toFixed(2), rentAmount, depositAmount,
        status: SePayAttemptStatus.PENDING, providerTransactionId: null, paidAt: null,
      }));
    });

    const returnBase = publicApiUrl.replace(/\/+$/, '');
    const description = purpose === 'BOOKING' ? 'tien thue va tien coc' : purpose === PaymentPurpose.DEPOSIT ? 'tien coc' : 'tien thue';
    const fields: SePayCheckoutFields = {
      order_amount: String(Math.round(Number(attempt.amount))),
      merchant: merchantId,
      currency: 'VND',
      operation: 'PURCHASE',
      order_description: 'VoltGo ' + description + ' don #' + bookingId,
      order_invoice_number: attempt.invoiceNumber,
      success_url: returnBase + '/api/payments/sepay/return?bookingId=' + bookingId + '&invoice=' + encodeURIComponent(attempt.invoiceNumber) + '&result=success',
      error_url: returnBase + '/api/payments/sepay/return?bookingId=' + bookingId + '&invoice=' + encodeURIComponent(attempt.invoiceNumber) + '&result=error',
      cancel_url: returnBase + '/api/payments/sepay/return?bookingId=' + bookingId + '&invoice=' + encodeURIComponent(attempt.invoiceNumber) + '&result=cancel',
    };
    return {
      provider: 'SEPAY',
      environment: environment.toUpperCase(),
      action: CHECKOUT_URLS[environment],
      method: 'POST',
      fields: { ...fields, lang: 'vi', signature: createSePaySignature(fields, secretKey) },
    };
  }

  async handleIpn(payload: any, suppliedSecret: string | undefined) {
    const environment = (this.config.get<string>('SEPAY_ENV') || 'sandbox').toUpperCase();
    const ipnSecret = this.config.get<string>('SEPAY_IPN_SECRET_' + environment)
      || (environment === 'SANDBOX' ? this.config.get<string>('SEPAY_IPN_SECRET') : undefined);
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
      const note = 'SePay ' + environment + ' transaction ' + String(payload.transaction.transaction_id || '');
      if (attempt.purpose === 'BOOKING') {
        if (attempt.rentAmount == null || attempt.depositAmount == null ||
            Math.round((Number(attempt.rentAmount) + Number(attempt.depositAmount)) * 100) !== Math.round(Number(attempt.amount) * 100)) {
          throw new BadRequestException('Phân bổ tiền thuê và tiền cọc của hóa đơn không hợp lệ');
        }
        const allocations: Array<{ purpose: PaymentPurpose.RENT | PaymentPurpose.DEPOSIT; amount: string }> = [
          { purpose: PaymentPurpose.RENT, amount: attempt.rentAmount },
          { purpose: PaymentPurpose.DEPOSIT, amount: attempt.depositAmount },
        ];
        for (const allocation of allocations) {
          if (Math.round(Number(allocation.amount) * 100) <= 0) continue;
          const idempotencyKey = 'sepay:' + attempt.invoiceNumber + ':' + allocation.purpose;
          const existing = await ledger.findOneBy({ idempotencyKey });
          if (existing) {
            if (existing.bookingId !== attempt.bookingId || existing.purpose !== allocation.purpose ||
                existing.method !== PaymentMethod.SEPAY ||
                Math.round(Number(existing.amount) * 100) !== Math.round(Number(allocation.amount) * 100)) {
              throw new BadRequestException('Bút toán SePay đã tồn tại nhưng không khớp phân bổ của hóa đơn');
            }
            continue;
          }
          await ledger.save(ledger.create({
            bookingId: attempt.bookingId, purpose: allocation.purpose, method: PaymentMethod.SEPAY,
            amount: allocation.amount, idempotencyKey, note, recordedById: booking.customerId,
          }));
        }
      } else {
        const idempotencyKey = 'sepay:' + attempt.invoiceNumber;
        const existing = await ledger.findOneBy({ idempotencyKey });
        if (!existing) {
          await ledger.save(ledger.create({
            bookingId: attempt.bookingId, purpose: attempt.purpose as PaymentPurpose.RENT | PaymentPurpose.DEPOSIT,
            method: PaymentMethod.SEPAY, amount: attempt.amount, idempotencyKey, note,
            recordedById: booking.customerId,
          }));
        } else if (existing.bookingId !== attempt.bookingId || existing.purpose !== attempt.purpose ||
                   existing.method !== PaymentMethod.SEPAY ||
                   Math.round(Number(existing.amount) * 100) !== Math.round(Number(attempt.amount) * 100)) {
          throw new BadRequestException('Bút toán SePay đã tồn tại nhưng không khớp hóa đơn');
        }
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
