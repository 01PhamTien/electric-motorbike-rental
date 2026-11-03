import 'reflect-metadata';
import { join } from 'node:path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { sqlServerConnectionOptions } from './sqlserver-options';

/** Standalone CLI data source: no Nest app bootstrap or schema synchronize. */
const production = process.env.NODE_ENV === 'production';
function variable(name: string, devFallback: string): string {
  const value = process.env[name];
  if (production && !value) throw new Error('Missing production database config: ' + name);
  return value || devFallback;
}
const port = Number(process.env.DB_PORT || 3307);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid DB_PORT');

const isSqlServer = process.env.DB_TYPE === 'mssql';
if (process.env.DB_TYPE && !['mssql', 'mysql'].includes(process.env.DB_TYPE)) {
  throw new Error('Unsupported DB_TYPE');
}
const databaseOptions: DataSourceOptions = isSqlServer ? sqlServerConnectionOptions() : {
  type: 'mysql',
  host: variable('DB_HOST', '127.0.0.1'),
  port,
  username: variable('DB_USERNAME', 'emr'),
  password: variable('DB_PASSWORD', 'emr123456'),
  database: variable('DB_DATABASE', 'electric_motorbike_rental'),
  timezone: '+07:00',
  synchronize: false,
  migrationsRun: false,
  logging: false,
};

export const migrationDataSource = new DataSource({
  ...databaseOptions,
  synchronize: false,
  migrationsRun: false,
  entities: [join(__dirname, '../modules/**/*.entity.{js,ts}')],
  migrations: [join(__dirname, isSqlServer ? 'migrations-mssql/*.{js,ts}' : 'migrations/*.{js,ts}')],
});
