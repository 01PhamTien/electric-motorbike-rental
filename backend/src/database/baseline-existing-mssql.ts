import { Table } from 'typeorm';
import { migrationDataSource } from './data-source';

/**
 * Safely adopts an existing SQL Server database previously created by TypeORM
 * synchronize. It never alters application tables or rows.
 */
async function main() {
  if (process.env.DB_TYPE !== 'mssql') throw new Error('Set DB_TYPE=mssql before using the SQL Server baseline tool');
  if (process.env.NODE_ENV === 'production') throw new Error('Run this adoption step during a controlled maintenance window, not from a production app process');
  if (process.env.BASELINE_CONFIRM !== 'I_HAVE_A_VERIFIED_BACKUP') {
    throw new Error('Set BASELINE_CONFIRM=I_HAVE_A_VERIFIED_BACKUP only after creating and testing a full SQL Server backup');
  }

  await migrationDataSource.initialize();
  const runner = migrationDataSource.createQueryRunner();
  try {
    const existing = await runner.query(
      "SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo' AND TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME NOT IN ('migrations')",
    );
    if (!Number(existing[0]?.total || 0)) {
      throw new Error('This SQL Server database is empty. Run migration:run:mssql instead of baseline.');
    }

    const changes = await migrationDataSource.driver.createSchemaBuilder().log();
    if (changes.upQueries.length) {
      console.error(changes.upQueries.slice(0, 10).map(q => q.query).join('\n'));
      throw new Error('Existing SQL Server schema differs from entity metadata. Do not baseline; review and migrate schema drift first.');
    }

    if (!(await runner.hasTable('migrations'))) {
      await runner.createTable(new Table({
        name: 'migrations',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'timestamp', type: 'bigint', isNullable: false },
          { name: 'name', type: 'varchar', isNullable: false },
        ],
      }));
    }

    const previous = await runner.query('SELECT TOP (1) id FROM [migrations]');
    if (previous.length) throw new Error('Migration history already exists. Refusing to insert a second baseline.');

    await runner.query(
      'INSERT INTO [migrations] ([timestamp], [name]) VALUES (@0, @1)',
      [1793664000001, 'InitialVoltGoSqlServer1793664000001'],
    );
    console.log('Existing SQL Server schema verified; initial baseline recorded. No application tables or rows modified.');
  } finally {
    await runner.release();
    await migrationDataSource.destroy();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
