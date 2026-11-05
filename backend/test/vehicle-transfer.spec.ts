import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { validateSync } from 'class-validator';
import { CreateVehicleTransferDto } from '../src/modules/transfers/vehicle-transfer.dto';

function validate(payload: Record<string, unknown>) {
  return validateSync(Object.assign(new CreateVehicleTransferDto(), payload));
}

test('accepts a valid transfer request', () => {
  assert.equal(validate({ vehicleId: 12, destinationStationId: 4, note: 'Cân bằng số lượng xe' }).length, 0);
});

test('rejects invalid vehicle and destination identifiers', () => {
  const errors = validate({ vehicleId: 0, destinationStationId: -2 });
  assert.ok(errors.some(error => error.property === 'vehicleId'));
  assert.ok(errors.some(error => error.property === 'destinationStationId'));
});

test('rejects notes longer than 500 characters', () => {
  assert.ok(validate({ vehicleId: 1, destinationStationId: 2, note: 'x'.repeat(501) })
    .some(error => error.property === 'note'));
});

test('allows an omitted note', () => {
  assert.equal(validate({ vehicleId: 1, destinationStationId: 2 }).length, 0);
});
