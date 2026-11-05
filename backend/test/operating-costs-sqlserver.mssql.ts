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

test('SQL Server: operating cost ledger columns and indexes are migrated', async () => {
  const dataSource = new DataSource({
    ...sqlServerConnectionOptions(),
    entities: [join(__dirname, '../src/modules/**/*.entity.ts')],
    synchronize: false,
    dropSchema: false,
  });
  await dataSource.initialize();
  try {
    const rows = await dataSource.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'operating_costs'",
    );
    const columns = new Set(rows.map((row: { COLUMN_NAME: string }) => row.COLUMN_NAME));
    for (const name of ['stationId','vehicleId','category','amount','energyKwh','unitPrice','occurredAt','note','recordedById','createdAt']) {
      assert.ok(columns.has(name), 'Missing operating cost column: ' + name);
    }
    const indexes = await dataSource.query(
      "SELECT name FROM sys.indexes WHERE object_id = OBJECT_ID('operating_costs')",
    );
    const names = new Set(indexes.map((row: { name: string }) => row.name));
    assert.ok(names.has('IDX_operating_costs_station_date'));
    assert.ok(names.has('IDX_operating_costs_vehicle_date'));
    const constraints = await dataSource.query(
      "SELECT name FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('operating_costs')",
    );
    const checkNames = new Set(constraints.map((row: { name: string }) => row.name));
    assert.ok(checkNames.has('CK_operating_costs_amount_positive'));
    assert.ok(checkNames.has('CK_operating_costs_energy_nonnegative'));
  } finally {
    await dataSource.destroy();
  }
});
