# @app/api — Phase 1 backend

NestJS + Prisma + PostgreSQL backend for the refurb system.

## Quick start

```bash
pnpm install
docker compose up -d              # start postgres + redis
pnpm prisma:migrate                # apply prisma migrations
pnpm prisma:seed                   # roles, permissions, categories, admin user
pnpm --filter @app/api dev         # http://localhost:3000/api/v1
```

Default admin: `admin@example.com` / `admin1234`.

## Schema additions in Phase 1

Two new models were added on top of the Phase 0 schema:

- `RefreshToken` — stores hashed refresh-token records for JWT rotation/logout.
- `CodeCounter` — atomic counter table backing the `CodeGeneratorService` (PO000001, PC000001, CPU000001, …) under `SELECT … FOR UPDATE`.

Run `pnpm prisma:migrate` (or `prisma migrate dev --name phase-1-additions`) to apply them.

## Auth

- `POST /api/v1/auth/login` (public, throttled 5/min)
- `POST /api/v1/auth/refresh` (public)
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

Set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in `.env` (any random strings for dev).

## RBAC

Every endpoint declares required permissions via `@Permissions('purchase:create')`. Users with the `ADMIN` role bypass permission checks. Permissions are seeded; `prisma/seed.ts` is the source of truth.
