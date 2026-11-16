import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePaymentDto } from '../src/modules/payments/dto';
import { PaymentMethod, PaymentPurpose } from '../src/modules/payments/payment.entity';

const valid = {
  purpose: PaymentPurpose.DEPOSIT,
  method: PaymentMethod.CASH,
  amount: 150000,
  idempotencyKey: 'deposit-booking-42-attempt-1',
};

test('trims idempotency keys before validation and persistence', async () => {
  const dto = plainToInstance(CreatePaymentDto, { ...valid, idempotencyKey: '  deposit-booking-42-attempt-1  ' });
  assert.equal(dto.idempotencyKey, 'deposit-booking-42-attempt-1');
  assert.deepEqual(await validate(dto), []);
});

test('rejects an empty idempotency key', async () => {
  const dto = plainToInstance(CreatePaymentDto, { ...valid, idempotencyKey: '' });
  const errors = await validate(dto);
  assert.ok(errors.some(error => error.property === 'idempotencyKey'));
});

test('rejects a whitespace-only idempotency key after trimming', async () => {
  const dto = plainToInstance(CreatePaymentDto, { ...valid, idempotencyKey: '   \t  ' });
  const errors = await validate(dto);
  assert.equal(dto.idempotencyKey, '');
  assert.ok(errors.some(error => error.property === 'idempotencyKey'));
});

test('rejects idempotency keys longer than the database column', async () => {
  const dto = plainToInstance(CreatePaymentDto, { ...valid, idempotencyKey: 'x'.repeat(101) });
  const errors = await validate(dto);
  assert.ok(errors.some(error => error.property === 'idempotencyKey'));
});
