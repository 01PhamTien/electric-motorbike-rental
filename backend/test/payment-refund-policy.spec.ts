import assert = require('node:assert/strict');
import test = require('node:test');
import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '../src/common/enums/booking-status.enum';
import { calculateRefundableDepositCents } from '../src/modules/payments/refund-policy';

test('allows a full deposit refund after a completed rental', () => {
  assert.equal(calculateRefundableDepositCents({
    bookingStatus: BookingStatus.COMPLETED,
    recordedDepositCents: 30000000,
    recordedRefundCents: 0,
    cancellationFeeCents: 0,
  }), 30000000);
});

test('allows cancelled booking refund after subtracting the cancellation fee', () => {
  assert.equal(calculateRefundableDepositCents({
    bookingStatus: BookingStatus.CANCELLED,
    recordedDepositCents: 30000000,
    recordedRefundCents: 0,
    cancellationFeeCents: 10000000,
  }), 20000000);
});

test('subtracts previous partial refunds and cancellation fee', () => {
  assert.equal(calculateRefundableDepositCents({
    bookingStatus: BookingStatus.CANCELLED,
    recordedDepositCents: 30000000,
    recordedRefundCents: 5000000,
    cancellationFeeCents: 10000000,
  }), 15000000);
});

test('never returns a negative refundable amount', () => {
  assert.equal(calculateRefundableDepositCents({
    bookingStatus: BookingStatus.CANCELLED,
    recordedDepositCents: 5000000,
    recordedRefundCents: 0,
    cancellationFeeCents: 10000000,
  }), 0);
});

test('rejects refund before a booking is completed or cancelled', () => {
  assert.throws(() => calculateRefundableDepositCents({
    bookingStatus: BookingStatus.RENTING,
    recordedDepositCents: 30000000,
    recordedRefundCents: 0,
    cancellationFeeCents: 0,
  }), BadRequestException);
});

test('rejects invalid money totals', () => {
  assert.throws(() => calculateRefundableDepositCents({
    bookingStatus: BookingStatus.COMPLETED,
    recordedDepositCents: -1,
    recordedRefundCents: 0,
    cancellationFeeCents: 0,
  }), BadRequestException);
});
