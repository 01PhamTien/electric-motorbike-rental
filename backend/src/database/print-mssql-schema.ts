import { migrationDataSource } from './data-source';

async function main() {
  if (process.env.DB_TYPE !== 'mssql' || process.env.NODE_ENV === 'production') {
    throw new Error('SQL Server schema printing is only for non-production SQL Server CI');
  }
  await migrationDataSource.initialize();
  try {
    const schemaBuilder = migrationDataSource.driver.createSchemaBuilder();
    const sql = await schemaBuilder.log();
    console.log('MSSQL_SCHEMA_START' + JSON.stringify(sql.upQueries.map(q => q.query)) + 'MSSQL_SCHEMA_END');
  } finally {
    await migrationDataSource.destroy();
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
