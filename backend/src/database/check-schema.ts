import { migrationDataSource } from './data-source';

async function main() {
  await migrationDataSource.initialize();
  try {
    const changes = await migrationDataSource.driver.createSchemaBuilder().log();
    if (changes.upQueries.length) {
      for (const item of changes.upQueries.slice(0, 10)) console.error('SCHEMA_DRIFT:', item.query);
      throw new Error('Database schema differs from entity metadata. Apply a reviewed migration, never synchronize in production.');
    }
    console.log('Schema matches TypeORM entities; no pending schema changes.');
  } finally {
    await migrationDataSource.destroy();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
