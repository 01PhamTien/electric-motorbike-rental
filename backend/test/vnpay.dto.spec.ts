import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaymentPurpose } from '../src/modules/payments/payment.entity';
import { CreateVnPayCheckoutDto } from '../src/modules/payments/vnpay.dto';

test('accepts deposit and rent checkout purposes', async () => {
  for (const purpose of [PaymentPurpose.DEPOSIT, PaymentPurpose.RENT]) {
    const dto = plainToInstance(CreateVnPayCheckoutDto, { purpose, idempotencyKey: 'booking-42-checkout' });
    assert.deepEqual(await validate(dto), []);
  }
});

test('rejects refund and extra purposes for VNPay checkout', async () => {
  for (const purpose of [PaymentPurpose.REFUND, PaymentPurpose.EXTRA]) {
    const dto = plainToInstance(CreateVnPayCheckoutDto, { purpose, idempotencyKey: 'booking-42-checkout' });
    assert.ok((await validate(dto)).some(error => error.property === 'purpose'));
  }
});

test('rejects short and missing idempotency keys', async () => {
  for (const idempotencyKey of ['short', undefined]) {
    const dto = plainToInstance(CreateVnPayCheckoutDto, { purpose: PaymentPurpose.DEPOSIT, idempotencyKey });
    assert.ok((await validate(dto)).some(error => error.property === 'idempotencyKey'));
  }
});
