import { Table } from 'typeorm';
import { migrationDataSource } from './data-source';

/**
 * For a legacy installation whose tables were created with synchronize=true.
 * This does NOT modify application data or tables. Requires an explicit backup acknowledgement.
 * Refuses to run if entity metadata differs from the current schema.
 */
async function main() {
  if (process.env.BASELINE_CONFIRM !== 'I_HAVE_A_VERIFIED_BACKUP') {
    throw new Error('Set BASELINE_CONFIRM=I_HAVE_A_VERIFIED_BACKUP after creating and testing a database backup');
  }
  await migrationDataSource.initialize();
  const runner = migrationDataSource.createQueryRunner();
  try {
    const existing = await runner.query(
      "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' AND table_name NOT IN ('migrations')",
    );
    if (!Number(existing[0]?.total || 0)) throw new Error('This is an empty database. Run migration:run instead.');
    const changes = await migrationDataSource.driver.createSchemaBuilder().log();
    if (changes.upQueries.length) {
      console.error(changes.upQueries.slice(0, 5).map(q => q.query).join('\n'));
      throw new Error('Existing schema does not match initial migration metadata. Do not baseline. Review differences first.');
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
    const previous = await runner.query('SELECT id FROM migrations LIMIT 1');
    if (previous.length) throw new Error('Migration history already exists. Refusing to insert baseline.');
    await runner.query(
      'INSERT INTO migrations (timestamp, name) VALUES (?, ?)',
      [1793664000000, 'InitialRentalSchema1793664000000'],
    );
    console.log('Existing schema verified; initial baseline recorded. No application tables or rows modified.');
  } finally {
    await runner.release();
    await migrationDataSource.destroy();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
