---
name: liteerp-install
description: |
  Full end-to-end installer for the LiteERP monorepo (NestJS API + Next.js web + Postgres/Redis/MinIO + Prisma).
  Use when the user asks to install / bootstrap / set up / cài đặt / khởi tạo the LiteERP tool on a new machine
  or when they say "chạy lại từ đầu" / "reset môi trường" / "start fresh".
  This skill checks prerequisites, brings up infrastructure via Docker, writes the .env, runs migrations + seed,
  and starts both dev servers. Idempotent — safe to re-run.
---

# LiteERP — auto install skill

Purpose: bring a fresh (or partially set-up) checkout of LiteERP to a running state:
- Postgres / Redis / MinIO containers up
- `.env` populated with working local defaults
- Prisma client generated, migrations applied, DB seeded
- API + web dev servers running
- Login: `admin@example.com` / `admin1234`

Target repo root: `<repo>/` — everything below assumes CWD is repo root unless noted.

## 0. Pre-flight — refuse to run outside the repo

Before doing anything, verify the CWD contains these markers. If any missing, **stop and ask** where the repo lives.

```
package.json           # must contain "name": "computer-refurb-system"
pnpm-workspace.yaml
apps/api/package.json
apps/web/package.json
docker-compose.yml
apps/api/prisma/schema.prisma
```

## 1. Check prerequisites

Run in parallel. Bail with a clear error if any missing.

| Tool | Min version | Check command |
|------|-------------|---------------|
| Node.js | 20.0.0 | `node --version` |
| pnpm | 9.0.0 | `pnpm --version` |
| Docker | any recent | `docker --version` |
| Docker Compose | v2 | `docker compose version` |

If `pnpm` is missing but Node ≥ 20 is present, install pnpm via corepack:
```
corepack enable && corepack prepare pnpm@9.0.0 --activate
```

Do NOT try to install Node/Docker yourself — tell the user to install them and stop.

## 2. Install workspace dependencies

```
pnpm install
```

Run from repo root. This installs all workspaces (api + web + packages) in one pass.

## 3. Write `.env` (at repo root)

There is `.env.example` at the root. If `.env` already exists at repo root, **do not overwrite** — read it, keep custom values, only fill in blanks with the defaults below.

If `.env` does NOT exist, write it from the template `.env.template` shipped with this skill (see the file next to this SKILL.md). Key defaults:

- `NODE_ENV=development`
- `DATABASE_URL=postgresql://app:app@localhost:5432/app`
- `REDIS_URL=redis://localhost:6379`
- `S3_ENDPOINT=http://localhost:9000` · `S3_BUCKET=refurb-attachments` · `S3_ACCESS_KEY=minio` · `S3_SECRET_KEY=minio12345`
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` — **generate fresh random 64-char hex** each install. Never reuse across environments:
  - PowerShell: `-join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })`
  - Bash: `openssl rand -hex 32`
- `APP_URL` / `API_URL` — default `http://localhost:3000` and `http://localhost:3001`. If user is on LAN and needs mobile access, ask for the machine LAN IP and substitute.

Google Drive vars (`GOOGLE_DRIVE_*`) — leave blank on a fresh install. DriveService runs in DEGRADED mode (uploads fail with `DRIVE_NOT_CONFIGURED` but nothing crashes). Point the user to `docs/DRIVE_SETUP.md` and `apps/api/scripts/drive-oauth-init.ts` if they want Drive.

## 4. Bring up infrastructure

```
docker compose up -d postgres redis minio
```

Only these three — the `api`, `worker`, `web`, `nginx` services are for prod containers, and we're running dev via `pnpm dev` instead.

Wait for healthchecks. Poll:
```
docker inspect --format='{{.State.Health.Status}}' refurb-postgres
docker inspect --format='{{.State.Health.Status}}' refurb-redis
docker inspect --format='{{.State.Health.Status}}' refurb-minio
```
until all return `healthy`. Give up after ~60 s and report last status.

### 4a. MinIO bucket (idempotent)

MinIO doesn't auto-create the bucket. Create it once. Prefer `mc` if installed; otherwise use the AWS SDK-compatible curl:

Using `mc` (recommended if available):
```
mc alias set liteerp http://localhost:9000 minio minio12345
mc mb --ignore-existing liteerp/refurb-attachments
```

Or just tell the user to open http://localhost:9001, log in with `minio` / `minio12345`, and create bucket `refurb-attachments`. Bucket only matters for attachments-via-S3; Drive is preferred.

## 5. Prisma — generate + migrate + seed

Order matters. Run sequentially:

```
pnpm --filter @app/api prisma generate
pnpm --filter @app/api prisma migrate deploy
pnpm --filter @app/api prisma:seed
```

Notes:
- If `prisma generate` fails with **EPERM / query_engine-windows.dll.node** on Windows, the API dev server is still running and holding the DLL. Stop any `pnpm dev` / `pnpm dev:api` processes, or kill the node process on port 3001, then retry.
- `migrate deploy` (not `migrate dev`) — non-interactive, applies pending migrations only.
- Seed is idempotent (uses `upsert`). Safe to re-run.
- Seed creates: 7 roles, 41 permissions, 12 component categories, 3 sample suppliers, 3 sample customers, 9 sample components, code counters, and the admin user `admin@example.com` / `admin1234`.

## 6. Start dev servers

Preferred — one command runs both in parallel:
```
pnpm dev
```

Or two shells:
```
pnpm dev:api     # NestJS on :3001
pnpm dev:web     # Next.js on :3000
```

Do NOT foreground either from the skill — start them in the background. Report both URLs to the user:
- Web: http://localhost:3000
- API: http://localhost:3001/api/v1
- MinIO console: http://localhost:9001

## 7. Smoke test

Poll `http://localhost:3001/health` (or `/api/v1/health` — check main.ts) until it returns 200, up to ~60 s. Then confirm to user:

- ✅ Postgres/Redis/MinIO up
- ✅ Migrations applied (report count from `prisma migrate status`)
- ✅ Seed complete
- ✅ API responsive
- ✅ Web serving
- Login credentials: `admin@example.com` / `admin1234`

## Ports summary — quick reference

| Service | Port | URL |
|---|---|---|
| Web (Next.js dev) | 3000 | http://localhost:3000 |
| API (NestJS dev) | 3001 | http://localhost:3001 |
| Postgres | 5432 | `postgresql://app:app@localhost:5432/app` |
| Redis | 6379 | `redis://localhost:6379` |
| MinIO S3 | 9000 | http://localhost:9000 |
| MinIO console | 9001 | http://localhost:9001 |

## Reset / re-install

If user says "reset" or "wipe":
```
docker compose down -v         # drops postgres/redis/minio VOLUMES — data lost
```
Then restart from step 4. Confirm destructive action with user first.

## Common failures & fixes

| Symptom | Cause | Fix |
|---|---|---|
| `EPERM ... query_engine-windows.dll.node` on `prisma generate` | Dev server holding DLL | Stop `pnpm dev:api`, kill port 3001 process, retry |
| `port is already allocated` on `docker compose up` | Another Postgres/Redis running locally | Stop the host service or change host port in `docker-compose.yml` |
| API logs `The column "X" does not exist` | Migration not applied | `pnpm --filter @app/api prisma migrate deploy` |
| `DRIVE_NOT_CONFIGURED` in API log | Google Drive vars empty | Expected on fresh install — either populate `GOOGLE_DRIVE_*` or ignore |
| Web can't reach API on phone/LAN | `APP_URL`/`API_URL`/`NEXT_PUBLIC_API_URL` still `localhost` | Rewrite them to LAN IP, restart both dev servers |
| Login says invalid credentials | Seed didn't run or admin was disabled | Re-run `pnpm --filter @app/api prisma:seed` |

## What NOT to do

- Never commit `.env` — it's already `.gitignore`d, keep it that way.
- Never generate JWT secrets from a fixed string. Always use a real random source.
- Never run `prisma migrate dev` non-interactively — use `migrate deploy`.
- Don't try to `docker compose up api web worker nginx` for dev — those are prod-mode containers with a different code path; use `pnpm dev` instead.
- Don't run `pnpm prisma generate` while `pnpm dev:api` is running on Windows (DLL lock).
