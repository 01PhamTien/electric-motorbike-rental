# Production deployment preparation

This repository now contains Docker images and a production Compose topology. This is a deployment template, not a claim that the application is ready for public traffic.

## Architecture

- Nginx serves the built React/Vite application and proxies /api requests to NestJS.
- NestJS connects to MySQL over the private Compose network.
- MySQL has a persistent named volume and is not published to the host.
- The web container binds to 127.0.0.1:8080. Put a TLS reverse proxy (for example Caddy or Nginx with a valid certificate) in front of it.
- Manual GPS simulation remains manual; this deployment does not add GPS hardware or payment gateway integrations.

## Important release blockers

1. The repository currently has no TypeORM migration set or migration command. Production has synchronize disabled intentionally. Do not enable synchronize to make deployment start. Create and review migrations for the current schema, apply them to a staging database, and verify rollback/backup first.
2. The seed script creates known demo ADMIN/STAFF credentials. Do not run the seed script on a public production database. Create a unique administrator through a controlled one-time provisioning process and rotate any demo credentials.
3. Decide and document late-return/cancellation fee rules and accounting revenue recognition before claiming those business rules are complete.
4. Configure a real domain and TLS reverse proxy before exposing the service publicly.

## Prepare the server

1. Install Docker Engine and Docker Compose plugin on a supported Linux VPS.
2. Clone the repository and check out the reviewed release branch/commit.
3. Create the production environment file:
   ```bash
   cp .env.production.example .env.production
   ```
4. Edit `.env.production`. Use long, unique random values for MYSQL_ROOT_PASSWORD, MYSQL_PASSWORD and JWT_SECRET. Set FRONTEND_URL to the exact HTTPS origin, e.g. https://rental.example.com.
5. Restrict permissions:
   ```bash
   chmod 600 .env.production
   ```
6. Do not commit `.env.production`, certificates, database dumps, or production secrets.

## Build and start after migrations are ready

Run from the repository root:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml build
docker compose --env-file .env.production -f docker-compose.production.yml up -d
docker compose --env-file .env.production -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.production.yml logs -f backend
```

The Compose stack publishes the web container only on 127.0.0.1:8080. Configure the host TLS proxy to forward HTTPS traffic to http://127.0.0.1:8080. Do not expose MySQL or port 3000 publicly.

## Database backup

Create a protected backup before schema changes and on a regular schedule:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml exec -T mysql sh -c 'exec mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction "$MYSQL_DATABASE"' > backup.sql
```

Store backups encrypted and outside the VPS. Test restoration in a separate database before relying on backups. Never commit backup files.

## Smoke tests after deployment

- Open the HTTPS website and verify the React app loads.
- Open /api/docs only if public Swagger exposure is approved; otherwise restrict it at the reverse proxy.
- Sign in with a non-demo administrator and verify authorized pages.
- Verify a customer can browse stations/vehicles but cannot access staff/admin APIs.
- Verify a staff account can operate only at its assigned station.
- Create a test booking and validate pickup/return, payment records and deposit reconciliation in staging.
- Verify maintenance, manual GPS simulation and report filters.
- Check application logs and database backups.

## Release gate

Do not point a public domain at the deployment until migrations are applied, demo credentials are disabled/rotated, TLS and firewall rules are active, backups have been restore-tested, and the end-to-end acceptance checklist passes.
