import assert = require('node:assert/strict');
import test = require('node:test');
import { BookingStatus } from '../src/common/enums/booking-status.enum';
import { PaymentMethod, PaymentPurpose, PaymentTransaction } from '../src/modules/payments/payment.entity';
import { Booking } from '../src/modules/bookings/booking.entity';
import { VnPayAttemptStatus, VnPayPaymentAttempt } from '../src/modules/payments/vnpay-payment-attempt.entity';
import { VnPayService } from '../src/modules/payments/vnpay.service';
import { signVnPayParams, VnPayParams } from '../src/modules/payments/vnpay.util';

const secret = 'unit-test-vnpay-secret';
const tmnCode = 'TESTMERCHANT';

function createHarness(overrides: Partial<VnPayPaymentAttempt> = {}, bookingOverrides: Partial<Booking> = {}) {
  const attempt: any = {
    id: 7, bookingId: 42, createdById: 9, purpose: PaymentPurpose.DEPOSIT,
    amount: '150000.00', txnRef: 'VG1760000000abcdef12345678',
    idempotencyKey: 'idempotency-hash', status: VnPayAttemptStatus.PENDING,
    responseCode: null, transactionNo: null, bankCode: null, payDate: null,
    expiresAt: new Date(Date.now() + 60_000), paidAt: null, ...overrides,
  };
  const booking: any = {
    id: 42, customerId: 9, status: BookingStatus.CONFIRMED,
    depositSnapshot: '150000.00', rentalAmount: '300000.00', ...bookingOverrides,
  };
  const writes: any[] = [];
  const attemptRepo = {
    findOne: async ({ where }: any) => where.txnRef ? attempt : attempt,
    save: async (value: any) => { Object.assign(attempt, value); return value; },
  };
  const bookingRepo = { findOne: async () => booking };
  const paymentRepo = {
    findOne: async () => null,
    find: async () => [],
    create: (value: any) => value,
    save: async (value: any) => { writes.push(value); return value; },
  };
  const manager = {
    getRepository(entity: unknown) {
      if (entity === VnPayPaymentAttempt) return attemptRepo;
      if (entity === Booking) return bookingRepo;
      if (entity === PaymentTransaction) return paymentRepo;
      throw new Error('Unexpected repository');
    },
  };
  const dataSource: any = { transaction: async (callback: (manager: any) => Promise<unknown>) => callback(manager) };
  const config: any = { get: (key: string) => ({
    VNPAY_ENABLED: 'true', VNPAY_HASH_SECRET: secret, VNPAY_TMN_CODE: tmnCode,
  } as Record<string, string>)[key] };
  const service = new VnPayService(dataSource, config);
  return { service, attempt, writes };
}

function callback(overrides: Partial<VnPayParams> = {}) {
  const params: VnPayParams = {
    vnp_Version: '2.1.0', vnp_Command: 'pay', vnp_TmnCode: tmnCode,
    vnp_TxnRef: 'VG1760000000abcdef12345678', vnp_Amount: '15000000',
    vnp_CurrCode: 'VND', vnp_ResponseCode: '00', vnp_TransactionStatus: '00',
    vnp_TransactionNo: '123456789', vnp_PayDate: '20261116220000', ...overrides,
  };
  return { ...params, vnp_SecureHash: signVnPayParams(params, secret) };
}

test('verified successful IPN creates exactly one VNPAY ledger transaction', async () => {
  const ctx = createHarness();
  const result = await ctx.service.handleIpn(callback());
  assert.deepEqual(result, { RspCode: '00', Message: 'Confirm Success' });
  assert.equal(ctx.writes.length, 1);
  assert.equal(ctx.writes[0].method, PaymentMethod.VNPAY);
  assert.equal(ctx.writes[0].purpose, PaymentPurpose.DEPOSIT);
  assert.equal(ctx.writes[0].amount, '150000.00');
  assert.equal(ctx.writes[0].idempotencyKey, 'vnpay:VG1760000000abcdef12345678');
  assert.equal(ctx.attempt.status, VnPayAttemptStatus.PAID);
});

test('rejects an invalid signature before opening a database transaction', async () => {
  const ctx = createHarness();
  const result = await ctx.service.handleIpn({ ...callback(), vnp_SecureHash: '0'.repeat(128) });
  assert.equal(result.RspCode, '97');
  assert.equal(ctx.writes.length, 0);
});

test('rejects callback amount that differs from the persisted attempt', async () => {
  const ctx = createHarness();
  const result = await ctx.service.handleIpn(callback({ vnp_Amount: '14999999' }));
  assert.equal(result.RspCode, '04');
  assert.equal(ctx.writes.length, 0);
});

test('records late success for manual reconciliation rather than discarding received funds', async () => {
  const ctx = createHarness({ status: VnPayAttemptStatus.EXPIRED, expiresAt: new Date(Date.now() - 60_000) });
  const result = await ctx.service.handleIpn(callback());
  assert.equal(result.RspCode, '00');
  assert.equal(ctx.writes.length, 1);
  assert.equal(ctx.attempt.status, VnPayAttemptStatus.PAID_REVIEW);
  assert.match(ctx.writes[0].note, /LATE_OR_CLOSED_BOOKING_REQUIRES_MANUAL_RECONCILIATION/);
});

test('flags a verified payment that would exceed the booking amount due', async () => {
  const ctx = createHarness();
  ctx.writes.push({ amount: '150000.00' });
  const original = ctx.service['dataSource'].transaction;
  (ctx.service['dataSource'] as any).transaction = async (callback: (manager: any) => Promise<unknown>) => {
    const manager: any = {
      getRepository(entity: unknown) {
        if (entity === VnPayPaymentAttempt) return {
          findOne: async () => ctx.attempt,
          save: async (value: any) => { Object.assign(ctx.attempt, value); return value; },
        };
        if (entity === Booking) return { findOne: async () => ({ id: 42, status: BookingStatus.CONFIRMED, depositSnapshot: '150000.00' }) };
        if (entity === PaymentTransaction) return {
          findOne: async () => null,
          find: async () => [{ amount: '150000.00' }],
          create: (value: any) => value,
          save: async (value: any) => { ctx.writes.push(value); return value; },
        };
        throw new Error('Unexpected repository');
      },
    };
    return callback(manager);
  };
  const result = await ctx.service.handleIpn(callback());
  assert.equal(result.RspCode, '00');
  assert.equal(ctx.attempt.status, VnPayAttemptStatus.PAID_REVIEW);
  assert.match(ctx.writes[1].note, /OVERPAYMENT_REQUIRES_MANUAL_RECONCILIATION/);
  (ctx.service['dataSource'] as any).transaction = original;
});

test('acknowledges duplicate successful IPN without creating another ledger entry', async () => {
  const ctx = createHarness({ status: VnPayAttemptStatus.PAID });
  const result = await ctx.service.handleIpn(callback());
  assert.equal(result.RspCode, '00');
  assert.equal(ctx.writes.length, 0);
});
