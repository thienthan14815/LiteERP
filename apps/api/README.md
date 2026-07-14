# @app/api — backend

NestJS + Drizzle ORM over SQLite. Runs standalone (on a dev machine or on-device
inside the Android APK) with no external database, cache, or object store.

## Quick start

```bash
pnpm install
pnpm --filter @app/api dev         # http://localhost:3001/api/v1
```

On first boot the API self-provisions: it creates the schema from
`src/database/ddl/init.sql`, applies pending migrations
(`src/database/migrations.ts`), and seeds roles / permissions / component
categories / the initial admin. No separate migrate or seed step is required.

### Initial admin

- Set `SEED_ADMIN_PASSWORD` (and optionally `SEED_ADMIN_EMAIL`) in `.env` to
  control the first admin account.
- If unset, a strong random password is generated and printed **once** in the
  boot log, and the account is flagged `mustChangePassword`.
- Change it via `POST /api/v1/auth/change-password` (revokes all other sessions).

## Auth

- `POST /api/v1/auth/login` (public, throttled 5/min, per-account lockout after 5 fails)
- `POST /api/v1/auth/refresh` (public, rotates the refresh token)
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/change-password`
- `GET /api/v1/auth/me`

Set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in `.env` — each must be at
least 32 characters or the API refuses to start (fail-closed).

## RBAC

Every endpoint declares required permissions via `@Permissions('purchase:create')`.
Users with the `ADMIN` role bypass permission checks. Roles, permissions, and
grants are seeded in `src/database/bootstrap.ts` (the source of truth).

## Data access

- ORM: Drizzle (`src/database/schema.ts`), connection in `src/database/db.service.ts`.
- Transactions: `DbService.transaction()` (serialized `BEGIN IMMEDIATE`).
- Code generation (PO000001, …): `CodeGeneratorService`, atomic `UPDATE … RETURNING`.

## API docs

Swagger UI at `/api/v1/docs` (enabled outside production, or with `SWAGGER_ENABLED=1`).
