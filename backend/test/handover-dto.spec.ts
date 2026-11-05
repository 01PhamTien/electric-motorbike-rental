import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { validateSync } from 'class-validator';
import { HandoverDto } from '../src/modules/handovers/dto';

function validate(payload: Record<string, unknown>) {
  return validateSync(Object.assign(new HandoverDto(), payload));
}

const base = { batteryPercent: 80, odometerKm: 1200.5, conditionNote: 'Xe hoạt động bình thường' };

test('accepts legacy handover payload without optional inspection fields', () => {
  assert.equal(validate(base).length, 0);
});

test('accepts a valid checklist, damage note and HTTPS evidence links', () => {
  const errors = validate({
    ...base,
    inspectionChecklist: ['BODY', 'LIGHTS', 'BRAKES', 'TIRES', 'MIRRORS', 'HORN', 'BATTERY', 'CHARGER', 'KEYS'],
    damageNotes: 'Trầy nhẹ ở yếm trái',
    photoUrls: ['https://cdn.example.test/evidence/pickup-1.jpg'],
  });
  assert.equal(errors.length, 0);
});

test('rejects unknown checklist values', () => {
  const errors = validate({ ...base, inspectionChecklist: ['BODY', 'SQL_INJECTION'] });
  assert.ok(errors.some(error => error.property === 'inspectionChecklist'));
});

test('rejects more than eight photo references', () => {
  const photoUrls = Array.from({ length: 9 }, (_, index) => 'https://cdn.example.test/' + index + '.jpg');
  const errors = validate({ ...base, photoUrls });
  assert.ok(errors.some(error => error.property === 'photoUrls'));
});

test('rejects non-URL photo evidence references', () => {
  const errors = validate({ ...base, photoUrls: ['javascript:alert(1)'] });
  assert.ok(errors.some(error => error.property === 'photoUrls'));
});
