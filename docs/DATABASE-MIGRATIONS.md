# SQL Server Express — existing local VoltGoDB

The SQL Server schema has its own migration history in \`backend/src/database/migrations-mssql\`. Never run MySQL migration commands against SQL Server.

## If VoltGoDB already contains tables created by TypeORM synchronize

Do **not** run the initial SQL Server migration directly against a populated database. First create and test a full backup of VoltGoDB. Then, from \`backend/\`, inspect:

\`\`\`powershell
npm run migration:show
npm run migration:check:mssql
\`\`\`

If the database is populated but has no migration history, and \`migration:check:mssql\` reports that the schema matches the current entities, adopt it with the guarded baseline tool:

\`\`\`powershell
$env:DB_TYPE = "mssql"
$env:BASELINE_CONFIRM = "I_HAVE_A_VERIFIED_BACKUP"
npm run migration:baseline:mssql
Remove-Item Env:BASELINE_CONFIRM
npm run migration:show
npm run migration:run:mssql
npm run migration:check:mssql
\`\`\`

The baseline tool refuses an empty database, refuses existing migration history, checks for schema drift, and inserts only the initial migration record. It does not alter application tables or data. After the baseline, pending additive migrations (such as editable vehicle images and customer reviews/issues) are applied normally.

If \`migration:check:mssql\` reports drift, **stop**. Do not use synchronize or baseline to hide the differences. Back up the database, review the printed SQL, and prepare a separate migration.

## If VoltGoDB is empty

Use only:

\`\`\`powershell
$env:DB_TYPE = "mssql"
npm run migration:show
npm run migration:run:mssql
npm run migration:check:mssql
\`\`\`

Never run \`migration:baseline:mssql\` on an empty database.

---

# Database migrations — MySQL 8.4

The production backend **never runs TypeORM synchronize**. This repository now uses an immutable initial migration:
`backend/src/database/migrations/1793664000000-InitialRentalSchema.ts`.

## Before touching production

1. Schedule maintenance and take a verified, restorable MySQL backup (schema **and** data). Test restore on a separate database.
2. Confirm the database target and credentials, and set `NODE_ENV=production`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`. Never run the destructive integration tests or demo seed against production.
3. Run migrations as an explicit deployment step **before** starting the new backend instances. Do not set `DB_SYNCHRONIZE=true` on production. Use a single migration runner, not one in each web replica.
4. Review subsequent migrations before execution. MySQL DDL commits implicitly; a failed migration may require restoring the verified backup rather than a transaction rollback.

## A fresh empty database

From `backend/` with Node 20 and dependencies installed:

```bash
npm ci
npm run migration:show
npm run migration:run
npm run migration:check
npm run migration:show
```

These commands use `src/database/data-source.ts` with `synchronize: false`. On a built deployment:

```bash
npm run build
npm run migration:run:prod
```

`migration:run:prod` reads compiled migration JavaScript under `dist/database/migrations`.

## An existing database previously created by synchronize

**Do not run the initial schema migration directly against an existing populated database.** Doing so would fail on existing tables. Instead:

1. Back up and verify restore. Ensure application writes are stopped during the operation.
2. Match the existing schema to the current entity metadata. Fix any drift with a separately reviewed migration; do not blindly run synchronize.
3. With `BASELINE_CONFIRM=I_HAVE_A_VERIFIED_BACKUP` set, execute `npm run migration:baseline`.
4. Baseline checks for application tables, **requires zero pending schema changes**, refuses pre-existing migration history, and then inserts only the baseline record in the `migrations` history table.
5. Run `npm run migration:show` and `npm run migration:check` to confirm nothing is pending. Release application writes only after validation.

The baseline tool never deletes application rows. If schema mismatch is found, it intentionally **stops** and prints the first differences. Examine them and create an explicit upgrade migration; do not weaken this guard.

## Further schema changes

- Add a new timestamped `MigrationInterface` under `src/database/migrations`, with reviewed SQL in `up` and safe `down` where feasible.
- Run the exact change through the MySQL 8.4 CI job, including `migration:check`.
- For destructive changes use expand/backfill/contract across deployments, and document the rollback/restore procedure.
- Never edit a migration already applied to any environment.

## Safety and scope

The initial migration creates the **current** bookings, users/staff roles, stations, vehicles, handovers, payments, maintenance and location tables. Creating/staff editing does not require extra columns beyond this schema. Its `down` intentionally refuses automatic destruction; restoring a database backup is safer than dropping all customer and payment data.

The legacy PR #1 has *different* future schema additions (e.g. maintenance windows, images) and must be migrated separately if those features are adopted. These migrations do **not** silently bring PR #1's extra entities into the production schema.
