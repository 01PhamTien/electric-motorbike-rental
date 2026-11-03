import { DataSource, DataSourceOptions } from 'typeorm';
import { sqlServerConnectionOptions } from './sqlserver-options';

async function main() {
  const database = process.env.DB_DATABASE || '';
  if (process.env.DB_TYPE !== 'mssql' || process.env.NODE_ENV === 'production' || !/^[A-Za-z0-9_]+_test$/.test(database)) {
    throw new Error('Only disposable SQL Server *_test databases may be created by CI');
  }
  const options = sqlServerConnectionOptions() as Extract<DataSourceOptions, { type: 'mssql' }>;
  const setup = new DataSource({ ...options, database: 'master', entities: [], synchronize: false });
  await setup.initialize();
  try {
    const existing = await setup.query('SELECT DB_ID(@0) AS id', [database]);
    if (existing[0]?.id != null) throw new Error('CI test database already exists; refusing to reuse it');
    await setup.query('CREATE DATABASE [' + database + ']');
    console.log('Created isolated SQL Server test database: ' + database);
  } finally {
    await setup.destroy();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
