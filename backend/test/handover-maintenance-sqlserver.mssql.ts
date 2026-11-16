import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { sqlServerConnectionOptions } from '../src/database/sqlserver-options';

const dbName = process.env.DB_DATABASE || '';
if (process.env.DB_TYPE !== 'mssql' || !/^[a-zA-Z0-9_]+_test$/.test(dbName)) {
  throw new Error('Refusing SQL Server handover schema test: DB_DATABASE must end in _test');
}

test('SQL Server: handover maintenance flag is persisted with a false default', async () => {
  const dataSource = new DataSource({
    ...sqlServerConnectionOptions(),
    entities: [join(__dirname, '../src/modules/**/*.entity.ts')],
    synchronize: false,
    dropSchema: false,
  });
  await dataSource.initialize();
  try {
    const rows = await dataSource.query(
      "SELECT DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='handover_records' AND COLUMN_NAME='requiresMaintenance'",
    );
    assert.equal(rows.length, 1, 'Missing handover_records.requiresMaintenance');
    assert.equal(String(rows[0].DATA_TYPE).toLowerCase(), 'bit');
    assert.equal(rows[0].IS_NULLABLE, 'NO');
    assert.match(String(rows[0].COLUMN_DEFAULT), /0/);
  } finally {
    await dataSource.destroy();
  }
});
