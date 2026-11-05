import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateVehicleTransferDto, TransferInspectionDto } from '../src/modules/transfers/vehicle-transfer.dto';

function validateCreate(payload: Record<string, unknown>) {
  return validateSync(Object.assign(new CreateVehicleTransferDto(), payload));
}
const validChecklist = { body:true, lights:true, brakes:true, tires:true, mirrors:true, horn:true, battery:true, charger:true, keys:true };
function validateInspection(payload: Record<string, unknown>) {
  return validateSync(plainToInstance(TransferInspectionDto, payload));
}

test('accepts a valid transfer request', () => {
  assert.equal(validateCreate({ vehicleId: 12, destinationStationId: 4, note: 'Cân bằng số lượng xe' }).length, 0);
});

test('rejects invalid vehicle and destination identifiers', () => {
  const errors = validateCreate({ vehicleId: 0, destinationStationId: -2 });
  assert.ok(errors.some(error => error.property === 'vehicleId'));
  assert.ok(errors.some(error => error.property === 'destinationStationId'));
});

test('rejects notes longer than 500 characters', () => {
  assert.ok(validateCreate({ vehicleId: 1, destinationStationId: 2, note: 'x'.repeat(501) })
    .some(error => error.property === 'note'));
});

test('allows an omitted note', () => {
  assert.equal(validateCreate({ vehicleId: 1, destinationStationId: 2 }).length, 0);
});

test('accepts complete dispatch or receipt inspection evidence', () => {
  const errors = validateInspection({
    batteryPercent: 76, odometerKm: 1250.5, conditionNote: 'Xe vận hành bình thường',
    inspectionChecklist: validChecklist, damageNotes: '', photoUrls: ['https://example.com/vehicle.jpg'],
  });
  assert.equal(errors.length, 0);
});

test('rejects battery percentages outside 0-100 and negative odometer', () => {
  const errors = validateInspection({
    batteryPercent: 120, odometerKm: -1, conditionNote: 'Kiểm tra',
    inspectionChecklist: validChecklist,
  });
  assert.ok(errors.some(error => error.property === 'batteryPercent'));
  assert.ok(errors.some(error => error.property === 'odometerKm'));
});

test('rejects missing checklist items and more than eight evidence photos', () => {
  const errors = validateInspection({
    batteryPercent: 80, odometerKm: 10, conditionNote: 'Kiểm tra',
    inspectionChecklist: { body: true },
    photoUrls: Array.from({ length: 9 }, (_, i) => `https://example.com/${i}.jpg`),
  });
  assert.ok(errors.some(error => error.property === 'inspectionChecklist'));
  assert.ok(errors.some(error => error.property === 'photoUrls'));
});
