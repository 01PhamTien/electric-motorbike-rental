import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '../src/common/enums/booking-status.enum';
import { calculateCancellationFee, NO_SHOW_GRACE_PERIOD_MS } from '../src/modules/bookings/cancellation-policy';

const pickup = new Date('2026-11-10T12:00:00.000Z');
test('pending customer cancellation is free', () => {
  assert.equal(calculateCancellationFee({
    type: 'CUSTOMER_CANCELLED', bookingStatus: BookingStatus.PENDING,
    rentalAmount: '500000', depositAmount: '300000', pickupAt: pickup,
    now: new Date('2026-11-09T12:00:00.000Z'),
  }), 0);
});
test('confirmed cancellation 24 hours or more before pickup is free', () => {
  assert.equal(calculateCancellationFee({
    type: 'CUSTOMER_CANCELLED', bookingStatus: BookingStatus.CONFIRMED,
    rentalAmount: '500000', depositAmount: '300000', pickupAt: pickup,
    now: new Date(pickup.getTime() - 24 * 60 * 60_000),
  }), 0);
});
test('confirmed cancellation inside 24 hours charges 20 percent capped at deposit', () => {
  assert.equal(calculateCancellationFee({
    type: 'CUSTOMER_CANCELLED', bookingStatus: BookingStatus.CONFIRMED,
    rentalAmount: '500000', depositAmount: '300000', pickupAt: pickup,
    now: new Date(pickup.getTime() - 2 * 60 * 60_000),
  }), 100000);
  assert.equal(calculateCancellationFee({
    type: 'CUSTOMER_CANCELLED', bookingStatus: BookingStatus.CONFIRMED,
    rentalAmount: '2000000', depositAmount: '100000', pickupAt: pickup,
    now: new Date(pickup.getTime() - 1 * 60 * 60_000),
  }), 100000);
});
test('customer cannot cancel after pickup time', () => {
  assert.throws(() => calculateCancellationFee({
    type: 'CUSTOMER_CANCELLED', bookingStatus: BookingStatus.CONFIRMED,
    rentalAmount: '500000', depositAmount: '300000', pickupAt: pickup,
    now: new Date(pickup.getTime() + 1),
  }), BadRequestException);
});
test('no-show is rejected before 30-minute grace period', () => {
  assert.throws(() => calculateCancellationFee({
    type: 'NO_SHOW', bookingStatus: BookingStatus.CONFIRMED,
    rentalAmount: '500000', depositAmount: '300000', pickupAt: pickup,
    now: new Date(pickup.getTime() + NO_SHOW_GRACE_PERIOD_MS - 1),
  }), BadRequestException);
});
test('no-show charges 30 percent capped at deposit after grace period', () => {
  assert.equal(calculateCancellationFee({
    type: 'NO_SHOW', bookingStatus: BookingStatus.CONFIRMED,
    rentalAmount: '500000', depositAmount: '300000', pickupAt: pickup,
    now: new Date(pickup.getTime() + NO_SHOW_GRACE_PERIOD_MS),
  }), 150000);
  assert.equal(calculateCancellationFee({
    type: 'NO_SHOW', bookingStatus: BookingStatus.CONFIRMED,
    rentalAmount: '2000000', depositAmount: '100000', pickupAt: pickup,
    now: new Date(pickup.getTime() + NO_SHOW_GRACE_PERIOD_MS),
  }), 100000);
});
test('staff cancellation does not incur a customer fee', () => {
  assert.equal(calculateCancellationFee({
    type: 'STAFF_CANCELLED', bookingStatus: BookingStatus.CONFIRMED,
    rentalAmount: '500000', depositAmount: '300000', pickupAt: pickup,
    now: new Date(pickup.getTime() - 1),
  }), 0);
});
