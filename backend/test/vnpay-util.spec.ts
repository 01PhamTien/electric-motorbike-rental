import assert = require('node:assert/strict');
import test = require('node:test');
import { buildVnPayQuery, formatVnPayDate, signVnPayParams, verifyVnPaySignature } from '../src/modules/payments/vnpay.util';

const secret = 'sandbox-secret-for-unit-tests-only';
const params = {
  vnp_Version: '2.1.0',
  vnp_Command: 'pay',
  vnp_OrderInfo: 'VoltGo DEPOSIT booking 42',
  vnp_Amount: '15000000',
  vnp_TxnRef: 'VG1730000000abcdef12345678',
};

test('sorts VNPay parameters lexicographically before signing', () => {
  assert.equal(
    buildVnPayQuery({ b: 'two words', a: 'value' }),
    'a=value&b=two+words',
  );
});

test('creates and verifies a HMAC-SHA512 signature', () => {
  const signed = { ...params, vnp_SecureHash: signVnPayParams(params, secret) };
  assert.equal(signed.vnp_SecureHash.length, 128);
  assert.equal(verifyVnPaySignature(signed, secret), true);
});

test('rejects a modified parameter after signing', () => {
  const signed = { ...params, vnp_SecureHash: signVnPayParams(params, secret) };
  assert.equal(verifyVnPaySignature({ ...signed, vnp_Amount: '15000001' }, secret), false);
});

test('rejects a missing or malformed signature', () => {
  assert.equal(verifyVnPaySignature(params, secret), false);
  assert.equal(verifyVnPaySignature({ ...params, vnp_SecureHash: 'abc' }, secret), false);
});

test('does not include signature metadata in the signed payload', () => {
  const signature = signVnPayParams(params, secret);
  assert.equal(verifyVnPaySignature({ ...params, vnp_SecureHashType: 'HmacSHA512', vnp_SecureHash: signature }, secret), true);
});

test('formats dates in Vietnam local time for VNPay', () => {
  assert.equal(formatVnPayDate(new Date('2026-11-16T15:00:00.000Z')), '20261116220000');
});
