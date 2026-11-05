import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ShiftHandoverDto } from '../src/modules/audit/shift.dto';

function validate(payload: Record<string, unknown>) {
  return validateSync(plainToInstance(ShiftHandoverDto, payload));
}

test('accepts a valid shift handover report', () => {
  assert.equal(validate({ summary: 'Đã kiểm tra trạm và bàn giao đầy đủ', pendingTasks: 'Theo dõi xe bảo dưỡng', checklist: ['Đã kiểm tra xe'], vehicleCount: 8, batteryCount: 12 }).length, 0);
});

test('requires a meaningful summary', () => {
  assert.ok(validate({ summary: 'x' }).some(error => error.property === 'summary'));
  assert.ok(validate({}).some(error => error.property === 'summary'));
});

test('rejects invalid stock counts and oversized checklist', () => {
  const errors = validate({ summary: 'Bàn giao ca', vehicleCount: -1, batteryCount: 1001, checklist: Array.from({ length: 21 }, () => 'Đã kiểm tra') });
  assert.ok(errors.some(error => error.property === 'vehicleCount'));
  assert.ok(errors.some(error => error.property === 'batteryCount'));
  assert.ok(errors.some(error => error.property === 'checklist'));
});

test('rejects unknown properties under the global whitelist policy', () => {
  assert.ok(validate({ summary: 'Bàn giao ca', unexpected: true }).some(error => error.property === 'unexpected'));
});
