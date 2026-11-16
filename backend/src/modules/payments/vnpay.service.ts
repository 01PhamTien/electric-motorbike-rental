import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID, createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { Role } from '../../common/enums/role.enum';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Booking } from '../bookings/booking.entity';
import { PaymentPurpose, PaymentMethod, PaymentTransaction } from './payment.entity';
import { CreateVnPayCheckoutDto } from './vnpay.dto';
import { VnPayAttemptStatus, VnPayPaymentAttempt } from './vnpay-payment-attempt.entity';
import { formatVnPayDate, signVnPayParams, verifyVnPaySignature, VnPayParams } from './vnpay.util';

@Injectable()
export class VnPayService {
  constructor(private readonly dataSource: DataSource, private readonly config: ConfigService) {}

  private settings() {
    const enabled = this.config.get<string>('VNPAY_ENABLED') === 'true';
    const tmnCode = this.config.get<string>('VNPAY_TMN_CODE')?.trim();
    const hashSecret = this.config.get<string>('VNPAY_HASH_SECRET')?.trim();
    const paymentUrl = this.config.get<string>('VNPAY_PAYMENT_URL') || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    const returnUrl = this.config.get<string>('VNPAY_RETURN_URL')?.trim();
    const ipnUrl = this.config.get<string>('VNPAY_IPN_URL')?.trim();
    if (!enabled || !tmnCode || !hashSecret || !returnUrl || !ipnUrl) {
      throw new ServiceUnavailableException('Thanh toán VNPay Sandbox chưa được cấu hình đầy đủ.');
    }
    if (!paymentUrl.startsWith('https://') || !returnUrl.startsWith('https://') || !ipnUrl.startsWith('https://')) {
      throw new ServiceUnavailableException('URL VNPay và Return URL phải sử dụng HTTPS.');
    }
    return { tmnCode, hashSecret, paymentUrl, returnUrl, ipnUrl };
  }

  private makePaymentUrl(attempt: VnPayPaymentAttempt, ipAddress: string): string {
    const { tmnCode, hashSecret, paymentUrl, returnUrl } = this.settings();
    const now = new Date();
    const params: VnPayParams = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Amount: String(Math.round(Number(attempt.amount) * 100)),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: attempt.txnRef,
      vnp_OrderInfo: 'VoltGo ' + attempt.purpose + ' booking ' + attempt.bookingId,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: ipAddress.replace(/^::ffff:/, '').slice(0, 45),
      vnp_CreateDate: formatVnPayDate(attempt.createdAt || now),
      vnp_ExpireDate: formatVnPayDate(attempt.expiresAt),
    };
    const query = new URLSearchParams({
      ...params,
      vnp_SecureHash: signVnPayParams(params, hashSecret),
    });
    return paymentUrl + '?' + query.toString();
  }

  async createCheckout(user: JwtUser, bookingId: number, dto: CreateVnPayCheckoutDto, ipAddress: string) {
    if (user.role !== Role.CUSTOMER) throw new ForbiddenException('Chỉ khách hàng mới có thể tự khởi tạo thanh toán trực tuyến.');
    if (![PaymentPurpose.DEPOSIT, PaymentPurpose.RENT].includes(dto.purpose)) throw new BadRequestException('VNPay chỉ hỗ trợ thanh toán tiền cọc và tiền thuê.');
    const clientKey = typeof dto.idempotencyKey === 'string' ? dto.idempotencyKey.trim() : '';
    if (clientKey.length < 8 || clientKey.length > 100) throw new BadRequestException('Mã yêu cầu thanh toán phải có từ 8 đến 100 ký tự.');
    const key = createHash('sha256').update(user.sub + ':' + clientKey).digest('hex');
    this.settings();
    return this.dataSource.transaction(async manager => {
      const bookingRepo = manager.getRepository(Booking);
      const booking = await bookingRepo.findOne({ where: { id: bookingId }, lock: { mode: 'pessimistic_write' } });
      if (!booking) throw new NotFoundException('Không tìm thấy đơn thuê.');
      if (booking.customerId !== user.sub) throw new ForbiddenException();
      if (dto.purpose === PaymentPurpose.DEPOSIT && booking.status !== BookingStatus.CONFIRMED) {
        throw new BadRequestException('Đơn không còn ở trạng thái cho phép thanh toán tiền cọc.');
      }
      if (dto.purpose === PaymentPurpose.RENT && ![BookingStatus.CONFIRMED, BookingStatus.RENTING, BookingStatus.COMPLETED].includes(booking.status)) {
        throw new BadRequestException('Chỉ thanh toán tiền thuê khi đơn đã được xác nhận.');
      }
      if (booking.status === BookingStatus.PENDING && booking.holdExpiresAt && booking.holdExpiresAt <= new Date()) {
        throw new BadRequestException('Thời gian giữ chỗ đã hết hạn. Vui lòng đặt xe lại.');
      }

      const attemptRepo = manager.getRepository(VnPayPaymentAttempt);
      const existingByKey = await attemptRepo.findOne({ where: { idempotencyKey: key } });
      if (existingByKey) {
        if (existingByKey.bookingId !== bookingId || existingByKey.purpose !== dto.purpose) {
          throw new BadRequestException('Mã yêu cầu đã được sử dụng cho giao dịch khác.');
        }
        if (existingByKey.status === VnPayAttemptStatus.PAID) throw new BadRequestException('Khoản thanh toán này đã hoàn tất.');
        if (existingByKey.status === VnPayAttemptStatus.PENDING && existingByKey.expiresAt > new Date()) {
          return { paymentUrl: this.makePaymentUrl(existingByKey, ipAddress), txnRef: existingByKey.txnRef, amount: existingByKey.amount, expiresAt: existingByKey.expiresAt };
        }
        if (existingByKey.status === VnPayAttemptStatus.PENDING) {
          existingByKey.status = VnPayAttemptStatus.EXPIRED;
          await attemptRepo.save(existingByKey);
        }
        throw new BadRequestException('Yêu cầu thanh toán này đã kết thúc. Vui lòng tạo yêu cầu mới.');
      }

      const paymentRepo = manager.getRepository(PaymentTransaction);
      const settled = await paymentRepo.find({ where: { bookingId, purpose: dto.purpose } });
      const paid = settled.reduce((sum, item) => sum + Math.round(Number(item.amount) * 100), 0);
      const due = Math.round(Number(dto.purpose === PaymentPurpose.DEPOSIT ? booking.depositSnapshot : booking.rentalAmount) * 100) - paid;
      if (!Number.isSafeInteger(due) || due <= 0) throw new BadRequestException('Khoản tiền này đã được thanh toán đủ.');
      if (due % 100 !== 0 || due > 999_999_999_999) throw new BadRequestException('Số tiền không hợp lệ đối với thanh toán VNPay bằng VND.');
      const pending = await attemptRepo.findOne({
        where: { bookingId, purpose: dto.purpose, status: VnPayAttemptStatus.PENDING },
        order: { createdAt: 'DESC' },
      });
      if (pending && pending.expiresAt > new Date() && Math.round(Number(pending.amount) * 100) === due) {
        return { paymentUrl: this.makePaymentUrl(pending, ipAddress), txnRef: pending.txnRef, amount: pending.amount, expiresAt: pending.expiresAt };
      }
      if (pending) {
        pending.status = VnPayAttemptStatus.EXPIRED;
        await attemptRepo.save(pending);
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 15 * 60_000);
      if (booking.status === BookingStatus.PENDING && booking.holdExpiresAt && booking.holdExpiresAt < expiresAt) {
        expiresAt.setTime(booking.holdExpiresAt.getTime());
      }
      if (expiresAt <= now) throw new BadRequestException('Thời gian giữ chỗ không đủ để thanh toán.');
      const txnRef = 'VG' + now.getTime() + randomUUID().replace(/-/g, '').slice(0, 16);
      const attempt = await attemptRepo.save(attemptRepo.create({
        bookingId, createdById: user.sub, purpose: dto.purpose,
        amount: (due / 100).toFixed(2), txnRef, idempotencyKey: key,
        status: VnPayAttemptStatus.PENDING, responseCode: null,
        transactionNo: null, bankCode: null, payDate: null, expiresAt, paidAt: null,
      }));
      return { paymentUrl: this.makePaymentUrl(attempt, ipAddress), txnRef, amount: attempt.amount, expiresAt };
    });
  }

  async handleIpn(input: Record<string, unknown>): Promise<{ RspCode: string; Message: string }> {
    const query: VnPayParams = {};
    for (const [key, value] of Object.entries(input)) {
      if (typeof value !== 'string') return { RspCode: '97', Message: 'Invalid parameters' };
      query[key] = value;
    }
    const secret = this.config.get<string>('VNPAY_HASH_SECRET')?.trim();
    const tmnCode = this.config.get<string>('VNPAY_TMN_CODE')?.trim();
    if (this.config.get<string>('VNPAY_ENABLED') !== 'true' || !secret || !tmnCode ||
        !query.vnp_TxnRef || !/^\d+$/.test(query.vnp_Amount || '') ||
        !/^\d{2}$/.test(query.vnp_ResponseCode || '') || !/^\d{2}$/.test(query.vnp_TransactionStatus || '') ||
        !verifyVnPaySignature(query, secret)) {
      return { RspCode: '97', Message: 'Invalid signature' };
    }
    if (query.vnp_TmnCode !== tmnCode || query.vnp_CurrCode !== 'VND' || query.vnp_Command !== 'pay' || query.vnp_Version !== '2.1.0') {
      return { RspCode: '97', Message: 'Invalid payment parameters' };
    }
    try {
      return await this.dataSource.transaction(async manager => {
        const attemptRepo = manager.getRepository(VnPayPaymentAttempt);
        const lookup = await attemptRepo.findOne({ where: { txnRef: query.vnp_TxnRef } });
        if (!lookup) return { RspCode: '01', Message: 'Order not found' };
        // Keep lock order consistent with the manual payment ledger: booking first, attempt second.
        const booking = await manager.getRepository(Booking).findOne({
          where: { id: lookup.bookingId }, lock: { mode: 'pessimistic_write' },
        });
        if (!booking) return { RspCode: '01', Message: 'Booking not found' };
        const attempt = await attemptRepo.findOne({
          where: { id: lookup.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!attempt) return { RspCode: '01', Message: 'Order not found' };
        if (String(Math.round(Number(attempt.amount) * 100)) !== query.vnp_Amount) {
          return { RspCode: '04', Message: 'Invalid amount' };
        }
        if (attempt.status === VnPayAttemptStatus.PAID) return { RspCode: '00', Message: 'Confirm Success' };

        const successful = query.vnp_ResponseCode === '00' && query.vnp_TransactionStatus === '00';
        attempt.responseCode = query.vnp_ResponseCode || '99';
        attempt.transactionNo = query.vnp_TransactionNo || null;
        attempt.bankCode = query.vnp_BankCode || null;
        attempt.payDate = query.vnp_PayDate || null;
        if (!successful) {
          if (attempt.status === VnPayAttemptStatus.PENDING) {
            attempt.status = VnPayAttemptStatus.FAILED;
            await attemptRepo.save(attempt);
          }
          return { RspCode: '00', Message: 'Confirm Success' };
        }

        // A verified success callback is authoritative even if the local attempt
        // expired while the customer was completing checkout. Funds actually
        // received must be recorded for reconciliation, never silently ignored.
        const paymentRepo = manager.getRepository(PaymentTransaction);
        const idempotencyKey = 'vnpay:' + attempt.txnRef;
        const existingPayment = await paymentRepo.findOne({ where: { idempotencyKey } });
        if (!existingPayment) {
          const settled = await paymentRepo.find({ where: { bookingId: attempt.bookingId, purpose: attempt.purpose } });
          const alreadyPaid = settled.reduce((sum, item) => sum + Math.round(Number(item.amount) * 100), 0);
          const cap = Math.round(Number(attempt.purpose === PaymentPurpose.DEPOSIT ? booking.depositSnapshot : booking.rentalAmount) * 100);
          const wouldExceed = alreadyPaid + Math.round(Number(attempt.amount) * 100) > cap;
          const note = 'VNPay transaction ' + (attempt.transactionNo || attempt.txnRef) + (wouldExceed ? ' · OVERPAYMENT_REQUIRES_MANUAL_RECONCILIATION' : '');
          await paymentRepo.save(paymentRepo.create({
            bookingId: attempt.bookingId,
            purpose: attempt.purpose,
            method: PaymentMethod.TRANSFER,
            amount: attempt.amount,
            idempotencyKey,
            note,
            recordedById: attempt.createdById,
          }));
        }
        attempt.status = VnPayAttemptStatus.PAID;
        attempt.paidAt = new Date();
        await attemptRepo.save(attempt);
        return { RspCode: '00', Message: 'Confirm Success' };
      });
    } catch {
      return { RspCode: '99', Message: 'Unknown error' };
    }
  }

  redirectAfterReturn(txnRef: string | undefined): string {
    const frontend = this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const url = new URL('/bookings/my', frontend);
    url.searchParams.set('payment', 'processing');
    if (txnRef && /^[A-Za-z0-9_-]{1,100}$/.test(txnRef)) url.searchParams.set('txnRef', txnRef);
    return url.toString();
  }

  async getStatus(user: JwtUser, txnRef: string) {
    const attempt = await this.dataSource.getRepository(VnPayPaymentAttempt).findOne({ where: { txnRef } });
    if (!attempt) throw new NotFoundException('Không tìm thấy giao dịch.');
    if (attempt.createdById !== user.sub && user.role !== Role.ADMIN) throw new ForbiddenException();
    return { txnRef: attempt.txnRef, bookingId: attempt.bookingId, purpose: attempt.purpose, amount: attempt.amount, status: attempt.status, responseCode: attempt.responseCode, paidAt: attempt.paidAt };
  }
}
