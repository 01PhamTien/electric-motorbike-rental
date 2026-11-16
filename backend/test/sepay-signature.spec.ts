import assert = require('node:assert/strict');
import test = require('node:test');
import { createHmac } from 'node:crypto';
import { createSePaySignature, safeSecretEquals } from '../src/modules/payments/sepay-signature';

test('creates SePay HMAC-SHA256 base64 signature in the documented field order', () => {
  const fields = {
    order_amount: '150000',
    merchant: 'MERCHANT_TEST',
    currency: 'VND',
    operation: 'PURCHASE',
    order_description: 'VoltGo deposit #42',
    order_invoice_number: 'VGABC123',
    customer_id: '7',
    payment_method: 'BANK_TRANSFER',
    success_url: 'https://voltgo.example/bookings/42/payments?result=success',
    error_url: 'https://voltgo.example/bookings/42/payments?result=error',
    cancel_url: 'https://voltgo.example/bookings/42/payments?result=cancel',
    ignored: 'not-signed',
  };
  const canonical = [
    'order_amount=150000', 'merchant=MERCHANT_TEST', 'currency=VND',
    'operation=PURCHASE', 'order_description=VoltGo deposit #42',
    'order_invoice_number=VGABC123', 'customer_id=7',
    'payment_method=BANK_TRANSFER',
    'success_url=https://voltgo.example/bookings/42/payments?result=success',
    'error_url=https://voltgo.example/bookings/42/payments?result=error',
    'cancel_url=https://voltgo.example/bookings/42/payments?result=cancel',
  ].join(',');
  const expected = createHmac('sha256', 'test-secret').update(canonical).digest('base64');
  assert.equal(createSePaySignature(fields, 'test-secret'), expected);
});

test('omits empty and zero-valued optional fields from the signature', () => {
  const fields = { order_amount: '1000', merchant: 'M', currency: 'VND', operation: 'PURCHASE', order_description: 'x', order_invoice_number: 'I', customer_id: '', payment_method: '0' };
  const expected = createHmac('sha256', 'secret')
    .update('order_amount=1000,merchant=M,currency=VND,operation=PURCHASE,order_description=x,order_invoice_number=I')
    .digest('base64');
  assert.equal(createSePaySignature(fields, 'secret'), expected);
});

test('compares IPN secrets without accepting missing or different values', () => {
  assert.equal(safeSecretEquals('ipn-secret', 'ipn-secret'), true);
  assert.equal(safeSecretEquals('wrong', 'ipn-secret'), false);
  assert.equal(safeSecretEquals(undefined, 'ipn-secret'), false);
  assert.equal(safeSecretEquals('', ''), false);
});
