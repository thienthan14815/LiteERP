# LiteERP — bảng tổng hợp yêu cầu

Tài liệu tham chiếu nhanh dùng chung với `SKILL.md`. Không lặp lại instructions —
xem SKILL.md cho luồng cài đặt.

## Runtime prerequisites

| Tool | Version | Kiểm tra |
|------|---------|----------|
| Node.js | >= 20.0.0 | `node --version` |
| pnpm | >= 9.0.0 | `pnpm --version` (nếu thiếu → `corepack enable && corepack prepare pnpm@9.0.0 --activate`) |
| Docker Engine | recent | `docker --version` |
| Docker Compose | v2 | `docker compose version` |
| OpenSSL (Bash) hoặc PowerShell 5+ | — | dùng để sinh JWT secret |
| (Optional) `mc` (MinIO client) | latest | tạo bucket tự động, không có thì tạo qua console web |

## Docker services (docker-compose.yml)

| Service | Image | Port host | Vai trò |
|---------|-------|-----------|---------|
| postgres | postgres:16 | 5432 | Primary DB. Creds `app / app / app` |
| redis | redis:7 | 6379 | BullMQ queue (không auth) |
| minio | minio/minio:latest | 9000 / 9001 | S3-compat storage. `minio / minio12345`. Bucket cần tạo: `refurb-attachments` |
| api | build apps/api | 3001→3000 | Chỉ dùng ở prod. Dev thì chạy `pnpm dev` native. |
| worker | build apps/api | — | BullMQ worker (prod). |
| web | build apps/web | 3000 | Chỉ dùng ở prod. |
| nginx | nginx:latest | 8080 | Reverse proxy (prod). |

Container names: `refurb-postgres`, `refurb-redis`, `refurb-minio`, `refurb-api`,
`refurb-worker`, `refurb-web`, `refurb-nginx`. Network `refurb-net` (bridge).
Volumes `postgres_data`, `redis_data`, `minio_data`.

## Ports mặc định (dev flow)

| Service | Port | URL |
|---|---|---|
| Web (Next.js dev) | 3000 | http://localhost:3000 |
| API (NestJS dev)  | 3001 | http://localhost:3001 |
| API health check  | 3001 | http://localhost:3001/api/v1/health |
| Postgres | 5432 | `postgresql://app:app@localhost:5432/app` |
| Redis    | 6379 | `redis://localhost:6379` |
| MinIO S3 | 9000 | http://localhost:9000 |
| MinIO console | 9001 | http://localhost:9001 (`minio` / `minio12345`) |

## Biến môi trường root `.env` (bắt buộc)

Được đọc bởi cả API và web (dev + docker).

**Required — API sẽ crash / behave sai nếu thiếu:**
- `DATABASE_URL` — chuỗi kết nối Postgres.
- `REDIS_URL` — chuỗi kết nối Redis.
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — random 64-hex; regen mỗi lần cài.
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` — MinIO.

**Có default hợp lý:**
- `NODE_ENV=development`
- `JWT_ACCESS_EXPIRES_IN=15m`, `JWT_REFRESH_EXPIRES_IN=30d`
- `APP_URL=http://localhost:3000`, `API_URL=http://localhost:3001`
- `BACKUP_ENABLED=false`, `BACKUP_CRON=0 3 * * *`, `BACKUP_TIMEZONE=Asia/Ho_Chi_Minh`

**Optional (Google Drive) — trống → DriveService chạy DEGRADED:**
- `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`, `GOOGLE_DRIVE_ROOT_FOLDER_ID`
- Sinh refresh token: `pnpm --filter @app/api exec ts-node scripts/drive-oauth-init.ts`
- Hướng dẫn đầy đủ: `docs/DRIVE_SETUP.md`

**Optional (chưa dùng):**
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.

## Cấu trúc Prisma

- Schema: `apps/api/prisma/schema.prisma`
- Migrations dir: `apps/api/prisma/migrations/` (mỗi migration là subdir chứa `migration.sql`)
- Seed: `apps/api/prisma/seed.ts`
  - 7 roles: ADMIN, MANAGER, WAREHOUSE, TECHNICIAN, SALES, ACCOUNTANT, VIEWER
  - 41 permissions (theo module × action)
  - 12 component categories: CPU, MB, RAM, SSD, HDD, GPU, PSU, CASE, FAN, WIFI, BT, OTHER
  - 3 supplier + 3 customer + 9 component mẫu
  - Admin: `admin@example.com` / `admin1234`
  - Code counters (SUP/CUS/CPU/RAM/SSD/GPU/PSU/MB)
  - Idempotent (upsert). Chạy lại an toàn.

Migrations hiện có (7):
```
20260626153055_init
20260701035958_drive_integration
20260701075103_supplier_profile_fields
20260701081233_backup_records
20260701090000_purchase_item_model_serial
20260701100000_sales_order_marketplace_fields
20260701110000_master_options
```

## Startup commands

Từ root:

```
pnpm dev            # song song API + Web
pnpm dev:api        # NestJS watch, port 3001
pnpm dev:web        # Next.js, port 3000
pnpm build          # build tất cả apps
pnpm docker:up      # docker compose up -d  (tất cả services prod)
pnpm docker:down    # docker compose down
pnpm prisma:generate
pnpm prisma:migrate     # migrate dev (interactive; dùng ở dev)
pnpm prisma:seed
```

Cài đặt lần đầu (script hoá) dùng `pnpm --filter @app/api prisma migrate deploy`
(non-interactive) thay cho `migrate dev`.

## Endpoints kiểm tra sức khoẻ

- `GET /api/v1/health` — API sống chưa (Nest module `health`).
- Trang login web: `http://localhost:3000/login`.
- MinIO health: `http://localhost:9000/minio/health/live`.

## Ghi chú Windows

- `prisma generate` sẽ báo `EPERM` cho `query_engine-windows.dll.node` nếu API
  dev server đang chạy (giữ DLL). Phải tắt `pnpm dev:api` trước khi regen.
- Ưu tiên PowerShell (`install.ps1`) — bash script chỉ chạy được nếu có Git-Bash
  hoặc WSL.

## Android APK / Voice Agent

Ngoài scope skill này. Tham chiếu:
- `ARCHITECTURE_apk.md` — build APK Capacitor.
- `ARCHITECTURE_voice_agent.md` — voice agent (Python).
- `pnpm cap:sync`, `pnpm android:build:debug`, `pnpm android:build:release`.
