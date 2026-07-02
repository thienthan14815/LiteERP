#!/usr/bin/env bash
# LiteERP auto-install — Linux / macOS / Git-Bash
# Idempotent. Chạy từ repo root:
#   bash .claude/skills/liteerp-install/install.sh
#
# Flags:
#   --skip-docker   Bỏ qua docker compose up
#   --skip-dev      Không khởi động dev
#   --reset-db      docker compose down -v trước (XOÁ HẾT DỮ LIỆU)

set -euo pipefail

SKIP_DOCKER=0
SKIP_DEV=0
RESET_DB=0
for a in "$@"; do
  case "$a" in
    --skip-docker) SKIP_DOCKER=1;;
    --skip-dev)    SKIP_DEV=1;;
    --reset-db)    RESET_DB=1;;
    *) echo "Unknown arg: $a" >&2; exit 2;;
  esac
done

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"
cd "$REPO_ROOT"

step()  { echo; echo "==> $*"; }
fail()  { echo "[FAIL] $*" >&2; exit 1; }

step "Repo root: $REPO_ROOT"

# ---- 0. markers ----
for f in package.json pnpm-workspace.yaml apps/api/package.json apps/web/package.json docker-compose.yml apps/api/prisma/schema.prisma; do
  [[ -f "$f" ]] || fail "Không thấy $f — đang ở đúng repo root chưa?"
done

# ---- 1. prereqs ----
step "Kiểm tra Node / pnpm / Docker"
command -v node >/dev/null || fail "Node chưa cài (cần >= 20)."
NODE_MAJOR=$(node --version | sed -E 's/^v([0-9]+)\..*/\1/')
(( NODE_MAJOR >= 20 )) || fail "Node $(node --version) — cần >= 20.0.0"

if ! command -v pnpm >/dev/null; then
  echo "pnpm chưa có — bật corepack"
  corepack enable
  corepack prepare pnpm@9.0.0 --activate
fi

command -v docker >/dev/null || fail "Docker chưa cài / chưa chạy."
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 chưa có."

echo "Node $(node --version) / pnpm $(pnpm --version) / docker OK"

# ---- 2. deps ----
step "pnpm install"
pnpm install

# ---- 3. .env ----
step ".env"
if [[ ! -f .env ]]; then
  echo ".env chưa có — sinh từ template + JWT secrets ngẫu nhiên"
  cp "$SCRIPT_DIR/.env.template" .env
  ACCESS=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 64)
  REFRESH=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 64)
  sed -i.bak "s|JWT_ACCESS_SECRET=REPLACE_WITH_RANDOM_64_HEX|JWT_ACCESS_SECRET=$ACCESS|" .env
  sed -i.bak "s|JWT_REFRESH_SECRET=REPLACE_WITH_RANDOM_64_HEX|JWT_REFRESH_SECRET=$REFRESH|" .env
  rm -f .env.bak
else
  echo ".env đã có — giữ nguyên"
fi

# ---- 4. docker ----
if (( ! SKIP_DOCKER )); then
  if (( RESET_DB )); then
    step "Reset — docker compose down -v (XOÁ VOLUMES)"
    docker compose down -v
  fi
  step "docker compose up -d postgres redis minio"
  docker compose up -d postgres redis minio

  step "Chờ healthcheck (tối đa 60s)"
  deadline=$(( $(date +%s) + 60 ))
  while (( $(date +%s) < deadline )); do
    ok=1
    for s in refurb-postgres refurb-redis refurb-minio; do
      st=$(docker inspect --format='{{.State.Health.Status}}' "$s" 2>/dev/null || echo "?")
      [[ "$st" == "healthy" ]] || { ok=0; break; }
    done
    (( ok )) && { echo "Tất cả healthy"; break; }
    sleep 2
  done
  (( ok )) || echo "[WARN] chưa healthy sau 60s — tiếp tục"

  # MinIO bucket
  step "MinIO bucket 'refurb-attachments'"
  if command -v mc >/dev/null; then
    mc alias set liteerp http://localhost:9000 minio minio12345 >/dev/null 2>&1 || true
    mc mb --ignore-existing liteerp/refurb-attachments >/dev/null 2>&1 || true
  else
    echo "[INFO] 'mc' không có — vào http://localhost:9001 (minio/minio12345) tạo bucket 'refurb-attachments' thủ công nếu cần."
  fi
else
  echo "--skip-docker — bỏ qua"
fi

# ---- 5. prisma ----
step "prisma generate"
pnpm --filter @app/api prisma generate

step "prisma migrate deploy"
pnpm --filter @app/api prisma migrate deploy

step "prisma seed"
pnpm --filter @app/api prisma:seed

# ---- 6. dev ----
if (( SKIP_DEV )); then
  echo
  echo "==> Cài đặt xong (bỏ qua khởi động dev)."
  echo "Chạy bằng tay: pnpm dev"
  exit 0
fi

step "Khởi động pnpm dev (nền)"
LOG="$SCRIPT_DIR/pnpm-dev.log"
nohup pnpm dev >"$LOG" 2>&1 &
echo "Log: $LOG"

step "Chờ API :3001 (tối đa 90s)"
deadline=$(( $(date +%s) + 90 ))
ready=0
while (( $(date +%s) < deadline )); do
  if curl -fsS http://localhost:3001/api/v1/health >/dev/null 2>&1; then
    ready=1; break
  fi
  sleep 2
done

echo
if (( ready )); then
  echo "==> DONE"
  echo "Web:            http://localhost:3000"
  echo "API:            http://localhost:3001/api/v1"
  echo "MinIO Console:  http://localhost:9001  (minio / minio12345)"
  echo "Login:          admin@example.com / admin1234"
else
  echo "[WARN] API chưa trả 200 sau 90s. Xem $LOG."
fi
