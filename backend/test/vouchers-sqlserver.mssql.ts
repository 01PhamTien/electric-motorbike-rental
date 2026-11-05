import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { sqlServerConnectionOptions } from '../src/database/sqlserver-options';

const dbName = process.env.DB_DATABASE || '';
if (process.env.DB_TYPE !== 'mssql' || !/^[a-zA-Z0-9_]+_test$/.test(dbName)) {
  throw new Error('Refusing SQL Server schema test: DB_DATABASE must end in _test');
}

test('SQL Server: voucher tables, booking snapshots and constraints are migrated', async () => {
  const dataSource = new DataSource({
    ...sqlServerConnectionOptions(),
    entities: [join(__dirname, '../src/modules/**/*.entity.ts')],
    synchronize: false,
    dropSchema: false,
  });
  await dataSource.initialize();
  try {
    const voucherColumns = await dataSource.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'vouchers'",
    );
    const redemptionColumns = await dataSource.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'voucher_redemptions'",
    );
    const bookingColumns = await dataSource.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'bookings'",
    );
    assert.ok(voucherColumns.some((row: { COLUMN_NAME: string }) => row.COLUMN_NAME === 'usageCount'));
    assert.ok(voucherColumns.some((row: { COLUMN_NAME: string }) => row.COLUMN_NAME === 'perCustomerLimit'));
    assert.ok(redemptionColumns.some((row: { COLUMN_NAME: string }) => row.COLUMN_NAME === 'discountAmount'));
    for (const name of ['baseRentalAmount','discountAmount','voucherId','voucherCodeSnapshot']) {
      assert.ok(bookingColumns.some((row: { COLUMN_NAME: string }) => row.COLUMN_NAME === name), `Missing booking voucher column: ${name}`);
    }
    const indexes = await dataSource.query(
      "SELECT name FROM sys.indexes WHERE object_id = OBJECT_ID('voucher_redemptions')",
    );
    assert.ok(indexes.some((row: { name: string }) => row.name === 'UQ_voucher_redemptions_booking'));
  } finally {
    await dataSource.destroy();
  }
});
