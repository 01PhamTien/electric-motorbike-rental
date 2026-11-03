# VoltGo: Local SQL Server Express (Windows)

This walkthrough targets an **empty** `VoltGoDB` on an existing local instance `SQLEXPRESS`.
SQL Server is optional; the existing MySQL/Docker workflow remains supported.

## 1. SQL Server / SSMS prerequisites

- SQL Server Express is running; TCP/IP is enabled in SQL Server Configuration Manager.
- SQL Server listens on `127.0.0.1:14333` (set **IPAll: TCP Dynamic Ports blank, TCP Port 14333**, restart SQL Server).
- Verify from PowerShell: `Test-NetConnection 127.0.0.1 -Port 14333` → `TcpTestSucceeded : True`.
- Database `VoltGoDB` has been created in SSMS.
- SQL Authentication is enabled (Mixed Mode), and an SQL login `voltgo_app` can connect to **VoltGoDB** with the appropriate local developer permissions. Never share the password.
- Do NOT confuse SQL Server `SQLEXPRESS` with a MySQL Docker container. MSSQL connects via TCP host/port, not a named-instance backslash in `DB_HOST`.

## 2. Configure backend local environment

From PowerShell in the project root:

```powershell
cd D:\electric-motorbike-rental\backend
Copy-Item .env.mssql.example .env
notepad .env
```

Edit `DB_PASSWORD` to the **existing** `voltgo_app` SQL password. Replace `JWT_SECRET` with a long random secret.
If `.env` already exists, back it up before overwriting it.
Keep `NODE_ENV=development`, `DB_TYPE=mssql`, `DB_PORT=14333`, `DB_SYNCHRONIZE=false`.
For local development only, `DB_TRUST_SERVER_CERTIFICATE=true` and `DB_ENCRYPT=false`.
Never commit a real `.env` or paste passwords into a chat.

## 3. Create the schema via SQL Server migrations

**Only for a new empty VoltGoDB.** From `backend/`:

```powershell
npm ci
npm run migration:show
npm run migration:run:mssql
npm run migration:check:mssql
npm run migration:show
```

Expected: the SQL Server initial migration is marked applied, and schema drift check prints that schema matches the entities.

The TypeORM migration uses the `migrations-mssql/` directory only when `DB_TYPE=mssql`. It will refuse to initialize a database with existing application tables.
The MySQL baseline/migrations under `migrations/` are **not** intended for SQL Server.

## 4. Optional development seed and start

Only if this is a disposable local demo environment (not production):

```powershell
npm run seed
npm run start:dev
```

The seed creates demo admin/staff accounts with known demo passwords. **Change their passwords immediately** and never expose the seeded environment to the internet.

Frontend, in a second terminal:

```powershell
cd D:\electric-motorbike-rental\frontend
npm ci
npm run dev
```

Visit the Vite development URL, then use /admin/staff to manage employee accounts.

## If a command fails

- **ELOGIN / 18456**: confirm SQL Authentication, login, password, and mapped VoltGoDB user. Inspect SQL Server error logs; do not delete the database.
- **EOPEN / 4060**: database missing, offline, inaccessible, or incorrect default database / user mapping.
- **ESOCKET / ETIMEOUT**: restart SQL Server after enabling TCP/IP and confirm `Test-NetConnection`.
- **Schema mismatch**: stop. Do not set `DB_SYNCHRONIZE=true` or run the MySQL migration.
- Check SQL Server instance TCP port; `DB_HOST` must be `127.0.0.1`, **not** `LAPTOP-...\\SQLEXPRESS`.

## Production caution

This guide is strictly for Windows local development. Production needs hardened credentials, TLS with certificate validation, restricted roles, backups and a separately tested deployment procedure. Do not keep developer `db_owner` permissions or trust arbitrary server certificates in production.

If VoltGoDB already contains important data, back it up and do not run the *initial* migration. Build a separately reviewed migration/upgrade plan instead.
