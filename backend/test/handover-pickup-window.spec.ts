import assert = require('node:assert/strict');
import test = require('node:test');
import { BadRequestException } from '@nestjs/common';
import { assertPickupWindow } from '../src/modules/handovers/handover-policy';

const pickupAt = new Date('2026-11-17T10:00:00.000Z');
const returnAt = new Date('2026-11-18T10:00:00.000Z');

test('rejects pickup before the scheduled pickup time', () => {
  assert.throws(
    () => assertPickupWindow(pickupAt, returnAt, new Date('2026-11-17T09:59:59.999Z')),
    BadRequestException,
  );
});

test('allows pickup exactly at the scheduled pickup time', () => {
  assert.doesNotThrow(() => assertPickupWindow(pickupAt, returnAt, pickupAt));
});

test('allows pickup during the scheduled rental window', () => {
  assert.doesNotThrow(() => assertPickupWindow(pickupAt, returnAt, new Date('2026-11-17T15:30:00.000Z')));
});

test('rejects pickup at or after the scheduled return time', () => {
  assert.throws(() => assertPickupWindow(pickupAt, returnAt, returnAt), BadRequestException);
});

test('rejects an invalid or reversed rental window', () => {
  assert.throws(
    () => assertPickupWindow(returnAt, pickupAt, new Date('2026-11-17T12:00:00.000Z')),
    BadRequestException,
  );
});
