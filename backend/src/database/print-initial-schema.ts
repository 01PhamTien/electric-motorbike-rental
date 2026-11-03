import { migrationDataSource } from './data-source';

async function main() {
  if (process.env.NODE_ENV === 'production' || !/_test$/.test(process.env.DB_DATABASE || '')) {
    throw new Error('Schema generation requires a disposable *_test database and non-production NODE_ENV');
  }
  await migrationDataSource.initialize();
  try {
    const existing = await migrationDataSource.query(
      "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'",
    );
    if (Number(existing[0]?.total || 0) !== 0) throw new Error('Refusing to generate baseline from a nonempty database');
    const sql = await migrationDataSource.driver.createSchemaBuilder().log();
    // CI logs are used only to author the immutable checked-in migration.
    console.log('BASELINE_SQL_START' + JSON.stringify(sql.upQueries.map(q => q.query)) + 'BASELINE_SQL_END');
  } finally {
    await migrationDataSource.destroy();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
