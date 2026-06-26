# Computer Refurbishment & Inventory Management System

Monorepo for an ERP-style system covering: used-PC purchasing, inspection, disassembly, component inventory, assembly, sales, and warranty.

## Stack

- **Backend**: NestJS + Prisma + PostgreSQL + Redis + BullMQ
- **Frontend**: Next.js (app router) + TypeScript + TailwindCSS + shadcn/ui
- **Auth**: JWT + Refresh token + RBAC
- **Storage**: S3-compatible (MinIO in dev)
- **Deploy**: Docker Compose + Nginx

## Layout

```
apps/
  api/        NestJS backend
  web/        Next.js frontend
packages/
  shared/     Shared types/DTOs between FE & BE
  ui/         (reserved) shared UI components
  config/     Shared eslint/tsconfig
docker/
  nginx/      Reverse proxy config
scripts/      Convenience dev scripts
```

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker + Docker Compose

## Setup

```bash
# 1. Copy environment file
cp .env.example .env
# Fill in JWT_ACCESS_SECRET / JWT_REFRESH_SECRET / S3 keys etc.

# 2. Install dependencies
pnpm install

# 3. Start infrastructure (postgres, redis, minio)
docker compose up -d postgres redis minio

# 4. Run Prisma migrations + seed
pnpm prisma:migrate
pnpm prisma:seed
```

## Run

```bash
# Run API + Web in dev mode (parallel)
pnpm dev

# Or individually
pnpm dev:api
pnpm dev:web

# Full stack via Docker
pnpm docker:up
```

API: http://localhost:3001 — Web: http://localhost:3000 — Nginx: http://localhost:8080

Default admin (after seed): `admin@example.com` / `admin1234`

## Phase 0 status

This is the foundation scaffold — no business logic yet. The Prisma schema is the contract for all subsequent phases.
