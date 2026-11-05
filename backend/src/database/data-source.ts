import 'dotenv/config';
import 'reflect-metadata';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { sqlServerConnectionOptions } from './sqlserver-options';

/** SQL Server-only migration data source. Never enables schema synchronization. */
if (process.env.DB_TYPE && process.env.DB_TYPE !== 'mssql') {
  throw new Error('VoltGo currently supports SQL Server only. Set DB_TYPE=mssql.');
}

export const migrationDataSource = new DataSource({
  ...sqlServerConnectionOptions(),
  synchronize: false,
  migrationsRun: false,
  entities: [join(__dirname, '../modules/**/*.entity.{js,ts}')],
  migrations: [join(__dirname, 'migrations-mssql/*.{js,ts}')],
});
