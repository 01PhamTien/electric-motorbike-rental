import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { calculateCombinedBookingAllocation } from '../src/modules/payments/sepay-settlement';

test('allocates one checkout across remaining rent and deposit balances', () => {
  const allocation = calculateCombinedBookingAllocation('450000.00', '1000000.00', []);
  assert.deepEqual(allocation, {
    rentAmountCents: 45000000,
    depositAmountCents: 100000000,
    totalAmountCents: 145000000,
    rentAmount: '450000.00',
    depositAmount: '1000000.00',
    totalAmount: '1450000.00',
  });
});

test('subtracts previously recorded rent and deposit independently', () => {
  const allocation = calculateCombinedBookingAllocation(450000, 1000000, [
    { purpose: 'RENT', amount: '100000.00' },
    { purpose: 'DEPOSIT', amount: '250000.00' },
    { purpose: 'EXTRA', amount: '50000.00' },
    { purpose: 'REFUND', amount: '10000.00' },
  ]);
  assert.equal(allocation.rentAmount, '350000.00');
  assert.equal(allocation.depositAmount, '750000.00');
  assert.equal(allocation.totalAmount, '1100000.00');
});

test('supports a fully paid component without charging it again', () => {
  const allocation = calculateCombinedBookingAllocation(450000, 1000000, [
    { purpose: 'RENT', amount: 450000 },
  ]);
  assert.equal(allocation.rentAmount, '0.00');
  assert.equal(allocation.depositAmount, '1000000.00');
  assert.equal(allocation.totalAmount, '1000000.00');
});

test('returns zero when both booking components are already paid', () => {
  const allocation = calculateCombinedBookingAllocation(450000, 1000000, [
    { purpose: 'RENT', amount: 450000 },
    { purpose: 'DEPOSIT', amount: 1000000 },
  ]);
  assert.equal(allocation.totalAmountCents, 0);
});

test('rounds decimal amounts to integer cents before summing', () => {
  const allocation = calculateCombinedBookingAllocation('100.10', '200.20', [
    { purpose: 'RENT', amount: '0.10' },
    { purpose: 'DEPOSIT', amount: '0.20' },
  ]);
  assert.equal(allocation.rentAmountCents, 10000);
  assert.equal(allocation.depositAmountCents, 20000);
  assert.equal(allocation.totalAmount, '300.00');
});
