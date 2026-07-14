# LiteERP — Computer Refurbishment & Inventory System

Monorepo for an ERP-style system covering used-PC purchasing, inspection, disassembly, component inventory, assembly, sales, and warranty.

The project targets a **single standalone Android APK**: the NestJS backend runs on-device (embedded Node), serving both the static-exported Next.js frontend and the API from `127.0.0.1`. There is no external server, database, or cache in the shipped app.

## Stack (current)

- **Backend**: NestJS + Drizzle ORM over **SQLite** (single file, on-device)
- **Frontend**: Next.js 14 (App Router, `output: "export"`) + TypeScript + TailwindCSS
- **Auth**: JWT access + rotated refresh tokens + RBAC; per-account lockout
- **File storage**: local filesystem (`UPLOAD_DIR`); optional Google Drive for images + DB backups
- **Background work**: in-process (no Redis/BullMQ); durable job ledger in SQLite
- **Packaging**: Capacitor → Android APK (WebView loads the on-device server)

> Historical note: earlier phases used Postgres + Redis + BullMQ + MinIO/S3 + Docker Compose. Those were removed for the on-device pivot. `docker-compose.yml` and `ARCHITECTURE.md` describe that legacy server topology and are kept for reference only.

## Layout

```
apps/
  api/        NestJS backend (Drizzle + SQLite, serves the static frontend)
  web/        Next.js frontend (static export)
packages/
  shared/     Shared types/DTOs (enum source of truth: src/types/enums.ts)
  ui/         (reserved) shared UI components
android/      Capacitor Android project
```

## Prerequisites

- Node.js >= 20
- pnpm >= 9

(No Docker / Postgres / Redis required.)

## Setup

```bash
# 1. Environment
cp .env.example apps/api/.env
#   Required: JWT_ACCESS_SECRET, JWT_REFRESH_SECRET (>= 32 chars each).
#   Recommended: SEED_ADMIN_PASSWORD (else a random one is generated & logged once).
#   Optional: GOOGLE_DRIVE_* for image/backup upload.

# 2. Install
pnpm install

# 3. First run creates the SQLite schema + seeds roles/permissions/admin
#    automatically on API boot — no migrate/seed step needed on a device.
#    For a dev machine you can also seed demo data:
pnpm --filter @app/api db:seed
```

## Run (dev)

```bash
pnpm dev:api        # http://localhost:3001/api/v1  (+ Swagger at /api/v1/docs)
pnpm dev:web        # http://localhost:3000
```

## Run (single-process, prod-like)

```bash
pnpm --filter @app/web build      # → apps/web/out (static export)
pnpm --filter @app/api build
node apps/api/dist/src/main.js    # serves API + frontend on one port
```

The first admin login uses the credentials printed in the API log on first boot
(or `SEED_ADMIN_PASSWORD`). Change it immediately via `POST /api/v1/auth/change-password`.

## Database

- SQLite file at `DATABASE_URL` (`file:...`).
- Schema is created on first boot from `apps/api/src/database/ddl/init.sql`, then
  brought up to date by the versioned migration runner
  (`apps/api/src/database/migrations.ts`) — safe for existing on-device files.
- Backups: SQLite file is checkpointed, zipped, and uploaded to Google Drive
  (scheduled + boot catch-up). Restore verifies integrity before swapping.

## Docs

- `apps/api/src` — see module folders; API reference via Swagger at `/api/v1/docs`.
- `rule.md` — engineering standards this codebase is measured against.
- `ARCHITECTURE_forSQL.md` — the on-device SQLite direction (current).
- `ARCHITECTURE.md`, `ARCHITECTURE_apk.md` — legacy / alternative designs.
