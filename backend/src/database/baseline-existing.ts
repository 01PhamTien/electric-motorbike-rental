import { migrationDataSource } from './data-source';

/**
 * Read-only diagnostic for a legacy SQL Server schema.
 *
 * This command deliberately DOES NOT create the migrations table, insert migration
 * history, alter schema, or run pending migrations. TypeORM entity comparison alone
 * cannot prove that every migration-specific index, constraint, or data invariant is
 * present, so it must never be used as authorization to adopt a populated database.
 *
 * A complete adoption workflow is tracked in GitHub issue #64.
 */
async function main() {
  if (process.env.DB_TYPE !== 'mssql') {
    throw new Error('Baseline preflight supports SQL Server only. Set DB_TYPE=mssql.');
  }
  if (process.env.BASELINE_CONFIRM !== 'I_HAVE_A_VERIFIED_BACKUP') {
    throw new Error('Read-only preflight requires BASELINE_CONFIRM=I_HAVE_A_VERIFIED_BACKUP after creating and testing a database backup.');
  }

  await migrationDataSource.initialize();
  const runner = migrationDataSource.createQueryRunner();
  try {
    const existing = await runner.query(
      "SELECT COUNT(*) AS [total] FROM [sys].[tables] WHERE [is_ms_shipped] = 0 AND [name] <> N'migrations'",
    );
    if (Number(existing[0]?.total ?? 0) === 0) {
      console.log('Database has no application tables. Use the normal SQL Server migration path.');
      return;
    }

    const historyExists = await runner.hasTable('migrations');
    if (historyExists) {
      const history = await runner.query(
        "SELECT COUNT(*) AS [total] FROM [dbo].[migrations]",
      );
      console.log('Existing migration history rows:', Number(history[0]?.total ?? 0));
    } else {
      console.log('No TypeORM migration history table exists.');
    }

    const changes = await migrationDataSource.driver.createSchemaBuilder().log();
    if (changes.upQueries.length) {
      console.error('ENTITY_SCHEMA_DRIFT:');
      for (const item of changes.upQueries.slice(0, 20)) console.error(item.query);
      throw new Error('Schema differs from TypeORM entity metadata. No changes were made.');
    }

    console.log('Entity metadata comparison passed, but this is NOT sufficient to baseline a populated database.');
    console.log('No tables or rows were changed. Migration adoption remains disabled pending the full verifier in issue #64.');
  } finally {
    await runner.release();
    await migrationDataSource.destroy();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
