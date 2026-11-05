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

test('SQL Server: vehicle transfer handover and receipt evidence columns are migrated', async () => {
  const dataSource = new DataSource({
    ...sqlServerConnectionOptions(),
    entities: [join(__dirname, '../src/modules/**/*.entity.ts')],
    synchronize: false,
    dropSchema: false,
  });
  await dataSource.initialize();
  try {
    const rows = await dataSource.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'vehicle_transfers'",
    );
    const columns = new Set(rows.map((row: { COLUMN_NAME: string }) => row.COLUMN_NAME));
    for (const name of [
      'dispatchBatteryPercent', 'dispatchOdometerKm', 'dispatchConditionNote',
      'dispatchChecklist', 'dispatchDamageNotes', 'dispatchPhotoUrls',
      'receiveBatteryPercent', 'receiveOdometerKm', 'receiveConditionNote',
      'receiveChecklist', 'receiveDamageNotes', 'receivePhotoUrls',
    ]) {
      assert.ok(columns.has(name), `Missing SQL Server migration column: ${name}`);
    }
  } finally {
    await dataSource.destroy();
  }
});
