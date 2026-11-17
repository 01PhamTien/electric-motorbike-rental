# SQL Server database migrations

VoltGo currently targets **Microsoft SQL Server**. The migration data source is `backend/src/database/data-source.ts`, uses `DB_TYPE=mssql`, and always has `synchronize: false` and `migrationsRun: false`. The production backend must never use TypeORM schema synchronization.

## Fresh, empty database

Use this path only when the target database has no application tables and is intended to be initialized from the checked-in SQL Server migrations.

From `backend/`:

```bash
npm ci
# Configure DB_TYPE=mssql and the SQL Server connection variables.
npm run migration:show
npm run migration:run:mssql
npm run migration:check:mssql
npm run migration:show
```

For a built deployment, build first and run the compiled migration command as a single explicit deployment step:

```bash
npm run build
npm run migration:run:prod
```

Do not run migration commands against a production database until the target, credentials, backup, restore test, and migration plan have been reviewed. Never run destructive integration tests or demo seed commands against production.

## Existing database with application data

**Do not run the initial migration against a populated database. Do not use TypeORM `synchronize` to make the schema match.**

The legacy baseline/adoption command is intentionally disabled. The only available preflight is read-only:

```bash
# Set DB_TYPE=mssql and configure the target SQL Server connection.
# First create a backup and test that it can be restored.
BASELINE_CONFIRM=I_HAVE_A_VERIFIED_BACKUP npm run migration:baseline:preflight
```

The preflight:
- Requires SQL Server and an explicit verified-backup acknowledgement.
- Counts application tables and checks whether migration history already exists.
- Refuses existing migration history.
- Compares TypeORM entity metadata and reports schema drift.
- Does **not** create a migration-history table, insert migration rows, alter schema, or change application data.

An entity metadata match is not proof that every migration-specific index, constraint, or data invariant is present. Therefore, a populated database is **not authorized for automatic baseline adoption**, even if the read-only preflight reports no entity drift. The legacy baseline command `npm run migration:baseline` deliberately exits with an error and performs no database changes.

Issue [#64](https://github.com/01PhamTien/electric-motorbike-rental/issues/64) tracks the full SQL Server legacy-schema verifier. Do not mark a populated database as adopted or run later migrations until that verifier can validate the exact target schema, migration-specific objects, and data invariants in a disposable restored copy. The remaining verification depends on a schema/data snapshot from the actual target database; CI against a newly created database cannot establish that the user's existing database is safe to adopt.

## Migration authoring

- Add timestamped TypeORM migrations under `backend/src/database/migrations-mssql`.
- Use SQL Server-compatible DDL and explicit, stable names for indexes, constraints, and foreign keys.
- Make migrations additive where possible. A `down` migration must refuse to destroy user-generated or financial records.
- Run `npm run build`, `npm test`, `npm run migration:run:mssql`, `npm run migration:check:mssql`, and the SQL Server integration suite before merging.
- Never edit a migration that may already have run in any environment. Create a new forward migration instead.

## Operational safety

1. Confirm the exact target database and SQL Server instance.
2. Take a full backup and test restoring it to a separate database.
3. Review the migration diff and expected schema changes.
4. Stop application writes or schedule a maintenance window when required.
5. Run migrations once, using one deployment runner rather than every web replica.
6. Verify migration history and schema after the run before restoring application traffic.

No command in this document authorizes changes to the user's existing database. Production migration execution remains an explicit deployment decision after backup and target verification.
