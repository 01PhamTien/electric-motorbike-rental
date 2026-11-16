import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { Role } from '../../common/enums/role.enum';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Booking } from '../bookings/booking.entity';
import { PaymentPurpose, PaymentMethod, PaymentTransaction } from './payment.entity';
import { OnlinePaymentAttempt, OnlinePaymentStatus } from './online-payment-attempt.entity';
import { CreateVnPayPaymentDto } from './vnpay.dto';
import { buildVnPayUrl, formatVnPayDate, toVnPayAmount, verifyVnPaySignature, VnPayParams } from './vnpay.util';

@Injectable()
export class VnPayService {
  constructor(private readonly ds: DataSource, private readonly config: ConfigService) {}

  private settings() {
    const tmnCode = this.config.get<string>('VNPAY_TMN_CODE')?.trim();
    const hashSecret = this.config.get<string>('VNPAY_HASH_SECRET')?.trim();
    if (!tmnCode || !hashSecret) {
      throw new ServiceUnavailableException('VNPay Sandbox chưa được cấu hình. Hãy khai báo VNPAY_TMN_CODE và VNPAY_HASH_SECRET trong backend/.env.');
    }
    const environment = this.config.get<string>('VNPAY_ENV', 'sandbox');
    if (environment !== 'sandbox') {
      throw new ServiceUnavailableException('Giai đoạn này chỉ cho phép VNPay Sandbox.');
    }
    return {
      tmnCode,
      hashSecret,
      paymentUrl: this.config.get<string>('VNPAY_PAYMENT_URL', 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'),
      returnUrl: this.config.get<string>('VNPAY_RETURN_URL'),
      expireMinutes: Math.min(30, Math.max(5, Number(this.config.get<string>('VNPAY_EXPIRE_MINUTES', '15')) || 15)),
    };
  }

  private assertCustomerOwnsBooking(user: JwtUser, booking: Booking): void {
    if (user.role !== Role.CUSTOMER || booking.customerId !== user.sub) {
      throw new ForbiddenException('Bạn không có quyền thanh toán đơn thuê này.');
    }
  }

  async createCheckout(user: JwtUser, bookingId: number, dto: CreateVnPayPaymentDto, ipAddress: string) {
    const settings = this.settings();
    if (!settings.returnUrl) throw new ServiceUnavailableException('Thiếu VNPAY_RETURN_URL.');
    const idempotencyKey = dto.idempotencyKey.trim();
    if (idempotencyKey.length < 8) throw new BadRequestException('Mã chống lặp giao dịch tối thiểu 8 ký tự.');

    return this.ds.transaction(async manager => {
      const bookingRepo = manager.getRepository(Booking);
      const booking = await bookingRepo.findOne({ where: { id: bookingId }, lock: { mode: 'pessimistic_write' } });
      if (!booking) throw new NotFoundException('Không tìm thấy đơn thuê.');
      this.assertCustomerOwnsBooking(user, booking);

      const attemptRepo = manager.getRepository(OnlinePaymentAttempt);
      const existingKey = await attemptRepo.findOne({ where: { idempotencyKey } });
      if (existingKey) {
        if (existingKey.bookingId !== bookingId || existingKey.purpose !== dto.purpose) {
          throw new ConflictException('Mã chống lặp đã được sử dụng cho giao dịch khác.');
        }
        if (existingKey.status !== OnlinePaymentStatus.PENDING || existingKey.expiresAt <= new Date()) {
          throw new ConflictException('Lần thanh toán này không còn hiệu lực. Hãy tạo yêu cầu mới.');
        }
        return { txnRef: existingKey.txnRef, amount: existingKey.amount, expiresAt: existingKey.expiresAt,
          paymentUrl: this.paymentUrl(settings, existingKey, ipAddress) };
      }

      const now = new Date();
      if ([BookingStatus.CANCELLED, BookingStatus.EXPIRED, BookingStatus.COMPLETED].includes(booking.status)) {
        throw new BadRequestException('Đơn thuê đã kết thúc hoặc bị hủy, không thể tạo thanh toán mới.');
      }
      if (booking.status === BookingStatus.PENDING && booking.holdExpiresAt && booking.holdExpiresAt <= now) {
        throw new BadRequestException('Thời gian giữ đơn đã hết hạn.');
      }
      if (dto.purpose === PaymentPurpose.RENT && ![BookingStatus.CONFIRMED, BookingStatus.RENTING].includes(booking.status)) {
        throw new BadRequestException('Chỉ thanh toán tiền thuê khi đơn đã được xác nhận hoặc đang thuê.');
      }

      const activePending = await attemptRepo.findOne({
        where: { bookingId, purpose: dto.purpose, status: OnlinePaymentStatus.PENDING },
        order: { createdAt: 'DESC' },
      });
      if (activePending && activePending.expiresAt > now) {
        throw new ConflictException('Đơn đang có một yêu cầu thanh toán cùng loại chưa hoàn tất. Hãy tiếp tục hoặc chờ yêu cầu hết hạn.');
      }
      if (activePending) {
        activePending.status = OnlinePaymentStatus.EXPIRED;
        await attemptRepo.save(activePending);
      }

      const transactions = await manager.getRepository(PaymentTransaction).find({ where: { bookingId } });
      const alreadyPaid = transactions
        .filter(item => item.purpose === dto.purpose)
        .reduce((sum, item) => sum + Math.round(Number(item.amount) * 100), 0);
      const totalDue = Math.round(Number(dto.purpose === PaymentPurpose.DEPOSIT ? booking.depositSnapshot : booking.rentalAmount) * 100);
      const remaining = totalDue - alreadyPaid;
      if (!Number.isSafeInteger(totalDue) || remaining <= 0) {
        throw new BadRequestException('Khoản thanh toán này đã đủ hoặc số tiền đơn thuê không hợp lệ.');
      }
      const amount = (remaining / 100).toFixed(2);
      const expiresAt = new Date(now.getTime() + settings.expireMinutes * 60_000);
      const attempt = attemptRepo.create({
        bookingId, purpose: dto.purpose, amount, idempotencyKey,
        txnRef: randomBytes(16).toString('hex'),
        status: OnlinePaymentStatus.PENDING, expiresAt,
      });
      await attemptRepo.save(attempt);
      return { txnRef: attempt.txnRef, amount: attempt.amount, expiresAt,
        paymentUrl: this.paymentUrl(settings, attempt, ipAddress) };
    });
  }

  private paymentUrl(settings: ReturnType<VnPayService['settings']>, attempt: OnlinePaymentAttempt, ipAddress: string): string {
    const now = new Date();
    const expireDate = attempt.expiresAt;
    const safeIp = ipAddress && ipAddress.length <= 45 ? ipAddress : '127.0.0.1';
    const params: VnPayParams = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: settings.tmnCode,
      vnp_Amount: toVnPayAmount(attempt.amount),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: attempt.txnRef,
      vnp_OrderInfo: `VoltGo ${attempt.purpose.toLowerCase()} booking ${attempt.bookingId}`,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: settings.returnUrl!,
      vnp_IpAddr: safeIp,
      vnp_CreateDate: formatVnPayDate(now),
      vnp_ExpireDate: formatVnPayDate(expireDate),
    };
    return buildVnPayUrl(settings.paymentUrl, params, settings.hashSecret);
  }

  async processIpn(params: VnPayParams): Promise<{ RspCode: string; Message: string }> {
    const settings = this.settings();
    if (!verifyVnPaySignature(params, settings.hashSecret)) return { RspCode: '97', Message: 'Invalid signature' };
    if (params.vnp_TmnCode !== settings.tmnCode) return { RspCode: '97', Message: 'Invalid merchant' };
    if (!params.vnp_TxnRef || !/^\d+$/.test(params.vnp_Amount ?? '')) return { RspCode: '99', Message: 'Invalid payment data' };

    try {
      return await this.ds.transaction(async manager => {
        const attemptRepo = manager.getRepository(OnlinePaymentAttempt);
        const attempt = await attemptRepo.findOne({
          where: { txnRef: params.vnp_TxnRef },
          lock: { mode: 'pessimistic_write' },
        });
        if (!attempt) return { RspCode: '01', Message: 'Order not found' };
        if (params.vnp_Amount !== toVnPayAmount(attempt.amount)) return { RspCode: '04', Message: 'Invalid amount' };
        if (attempt.status === OnlinePaymentStatus.PAID) return { RspCode: '00', Message: 'Confirm Success' };

        const success = params.vnp_ResponseCode === '00' && params.vnp_TransactionStatus === '00';
        attempt.vnpResponseCode = params.vnp_ResponseCode ?? null;
        attempt.vnpTransactionNo = params.vnp_TransactionNo ?? null;
        attempt.vnpBankCode = params.vnp_BankCode ?? null;
        attempt.vnpPayDate = params.vnp_PayDate ?? null;

        if (!success) {
          if (attempt.status === OnlinePaymentStatus.PENDING) {
            attempt.status = OnlinePaymentStatus.FAILED;
            await attemptRepo.save(attempt);
          }
          return { RspCode: '00', Message: 'Record payment result' };
        }

        const booking = await manager.getRepository(Booking).findOne({ where: { id: attempt.bookingId } });
        if (!booking) return { RspCode: '01', Message: 'Booking not found' };
        const paymentRepo = manager.getRepository(PaymentTransaction);
        const ledgerKey = `vnpay:${attempt.txnRef}`;
        const recorded = await paymentRepo.findOne({ where: { idempotencyKey: ledgerKey } });
        if (recorded) {
          if (recorded.bookingId !== attempt.bookingId || recorded.purpose !== attempt.purpose || Math.round(Number(recorded.amount) * 100) !== Math.round(Number(attempt.amount) * 100)) {
            return { RspCode: '99', Message: 'Payment ledger conflict' };
          }
        } else {
          await paymentRepo.save(paymentRepo.create({
            bookingId: attempt.bookingId,
            purpose: attempt.purpose,
            method: PaymentMethod.TRANSFER,
            amount: attempt.amount,
            idempotencyKey: ledgerKey,
            note: `VNPay transaction ${attempt.vnpTransactionNo ?? attempt.txnRef}`,
            recordedById: booking.customerId,
          }));
        }
        attempt.status = OnlinePaymentStatus.PAID;
        attempt.paidAt = attempt.paidAt ?? new Date();
        await attemptRepo.save(attempt);
        return { RspCode: '00', Message: 'Confirm Success' };
      });
    } catch {
      return { RspCode: '99', Message: 'Unknown error' };
    }
  }

  async resolveReturn(params: VnPayParams): Promise<string> {
    const settings = this.settings();
    const frontend = this.config.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const valid = verifyVnPaySignature(params, settings.hashSecret) && params.vnp_TmnCode === settings.tmnCode;
    const txnRef = params.vnp_TxnRef;
    let target = new URL('/bookings/my', frontend);
    if (valid && txnRef) {
      const attempt = await this.ds.getRepository(OnlinePaymentAttempt).findOne({ where: { txnRef } });
      if (attempt) {
        target = new URL(`/bookings/${attempt.bookingId}/payments`, frontend);
        target.searchParams.set('paymentRef', attempt.txnRef);
        target.searchParams.set('paymentReturn', '1');
      } else {
        target.searchParams.set('paymentReturn', 'not-found');
      }
    } else {
      target.searchParams.set('paymentReturn', 'invalid');
    }
    return target.toString();
  }

  async getStatus(user: JwtUser, txnRef: string) {
    const attempt = await this.ds.getRepository(OnlinePaymentAttempt).findOne({ where: { txnRef } });
    if (!attempt) throw new NotFoundException('Không tìm thấy giao dịch VNPay.');
    const booking = await this.ds.getRepository(Booking).findOne({ where: { id: attempt.bookingId } });
    if (!booking) throw new NotFoundException('Không tìm thấy đơn thuê.');
    this.assertCustomerOwnsBooking(user, booking);
    if (attempt.status === OnlinePaymentStatus.PENDING && attempt.expiresAt <= new Date()) {
      attempt.status = OnlinePaymentStatus.EXPIRED;
      await this.ds.getRepository(OnlinePaymentAttempt).save(attempt);
    }
    return { txnRef: attempt.txnRef, bookingId: attempt.bookingId, purpose: attempt.purpose,
      amount: attempt.amount, status: attempt.status, expiresAt: attempt.expiresAt, paidAt: attempt.paidAt };
  }
}
