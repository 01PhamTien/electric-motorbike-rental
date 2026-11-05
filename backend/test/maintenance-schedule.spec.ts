import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { validateSync } from 'class-validator';
import { UpsertMaintenanceScheduleDto } from '../src/modules/maintenance/maintenance-schedule.dto';

function validate(payload: Record<string, unknown>) {
  return validateSync(Object.assign(new UpsertMaintenanceScheduleDto(), payload));
}

const base = {
  vehicleId: 1, intervalKm: 3000, intervalDays: 90,
  warningKm: 500, warningDays: 7,
  lastServiceOdometerKm: 1250, lastServiceAt: '2026-10-01T08:00:00.000Z',
};

test('accepts a valid preventive maintenance schedule', () => {
  assert.equal(validate(base).length, 0);
});

test('rejects too-short kilometer intervals', () => {
  assert.ok(validate({ ...base, intervalKm: 50 }).some(error => error.property === 'intervalKm'));
});

test('rejects unreasonable calendar intervals', () => {
  assert.ok(validate({ ...base, intervalDays: 900 }).some(error => error.property === 'intervalDays'));
});

test('rejects negative odometer baseline', () => {
  assert.ok(validate({ ...base, lastServiceOdometerKm: -1 }).some(error => error.property === 'lastServiceOdometerKm'));
});

test('rejects malformed last-service date', () => {
  assert.ok(validate({ ...base, lastServiceAt: 'not-a-date' }).some(error => error.property === 'lastServiceAt'));
});
