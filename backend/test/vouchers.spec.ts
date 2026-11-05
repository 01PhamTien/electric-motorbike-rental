import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Voucher, VoucherDiscountType } from '../src/modules/vouchers/voucher.entity';
import { VouchersService } from '../src/modules/vouchers/vouchers.service';
import { CreateVoucherDto, PreviewVoucherDto } from '../src/modules/vouchers/dto';

const valid = {
  code: 'VOLTGO10', discountType: VoucherDiscountType.PERCENT, discountValue: 10,
  minRentalAmount: 100000, startsAt: '2026-01-01T00:00:00.000Z',
  endsAt: '2027-01-01T00:00:00.000Z', perCustomerLimit: 1,
};
test('accepts a valid percentage voucher', () => {
  assert.equal(validateSync(plainToInstance(CreateVoucherDto, valid)).length, 0);
});
test('rejects percentage discount above 100 and invalid codes', () => {
  const errors = validateSync(plainToInstance(CreateVoucherDto, { ...valid, code: 'BAD CODE', discountValue: 150 }));
  assert.ok(errors.some(e => e.property === 'code'));
  assert.ok(errors.some(e => e.property === 'discountValue'));
});
test('validates voucher preview amount', () => {
  const errors = validateSync(plainToInstance(PreviewVoucherDto, { code: 'VOLTGO10', rentalAmount: 0 }));
  assert.ok(errors.some(e => e.property === 'rentalAmount'));
});
function voucher(overrides: Partial<Voucher> = {}): Voucher {
  return {
    id: 7, code: 'VOLTGO10', discountType: VoucherDiscountType.PERCENT, discountValue: '10.00',
    maxDiscountAmount: '50000.00', minRentalAmount: '100000.00',
    startsAt: new Date('2026-01-01T00:00:00.000Z'), endsAt: new Date('2027-01-01T00:00:00.000Z'),
    usageLimit: 20, perCustomerLimit: 1, usageCount: 0, isActive: true, description: null,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
}
test('previews capped percentage discount and final rental total', async () => {
  const item = voucher();
  const service = new VouchersService(
    { findOneBy: async () => item } as any,
    { count: async () => 0 } as any,
  );
  const result = await service.preview(22, 'voltgo10', 800000);
  assert.equal(result.code, 'VOLTGO10');
  assert.equal(result.discountAmount, '50000.00');
  assert.equal(result.finalRentalAmount, '750000.00');
});
test('rejects exhausted per-customer and global voucher limits', async () => {
  const item = voucher();
  const service = new VouchersService(
    { findOneBy: async () => item } as any,
    { count: async () => 1 } as any,
  );
  await assert.rejects(() => service.preview(22, item.code, 800000), /hết lượt/);
  const exhausted = new VouchersService(
    { findOneBy: async () => voucher({ usageCount: 20 }) } as any,
    { count: async () => 0 } as any,
  );
  await assert.rejects(() => exhausted.preview(22, item.code, 800000), /hết lượt/);
});
test('rejects voucher below its minimum rental amount', async () => {
  const item = voucher();
  const service = new VouchersService(
    { findOneBy: async () => item } as any,
    { count: async () => 0 } as any,
  );
  await assert.rejects(() => service.preview(22, item.code, 50000), /tối thiểu/);
});
