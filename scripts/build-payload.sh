#!/usr/bin/env bash
# Rebuild the arm64 payload end-to-end after source changes.
#
#   bash scripts/build-payload.sh            # full rebuild
#   bash scripts/build-payload.sh --no-deploy  # skip pnpm deploy (dist/db refresh only)
#
# Output layout (bind-mounted into Docker arm64 tests and zipped into the APK):
#   payload/
#   ├── .env                 docker-test env (absolute /app/... paths)
#   ├── api/                 prod node_modules (hoisted, physicalized) + dist
#   ├── web/                 Next.js static export
#   ├── data/liteerp.sqlite  fresh seeded DB (schema + core + demo data)
#   └── lib/                 (legacy openssl libs — removed; Prisma is gone)
set -euo pipefail

cd "$(dirname "$0")/.."
# On Git Bash resolve to the native Windows path so node/sqlite3 opens the
# right file (POSIX /c/... would be treated as a relative-to-drive path).
ROOT="$(pwd -W 2>/dev/null || pwd)"

SQLITE3_VERSION="6.0.1"
# musl build: static-ish, runs on Alpine (docker test bench). The glibc build
# needs GLIBC_2.38 which Debian bookworm images don't have. On Android the
# addon comes from jniLibs instead — this copy is test-bench-only.
SQLITE3_ARM64_URL="https://github.com/TryGhost/node-sqlite3/releases/download/v${SQLITE3_VERSION}/sqlite3-v${SQLITE3_VERSION}-napi-v6-linuxmusl-arm64.tar.gz"

echo "=== 1. build shared + api + refresh web is assumed prebuilt (apps/web/out) ==="
pnpm --filter @app/shared build
pnpm --filter @app/api build

if [[ "${1:-}" != "--no-deploy" ]]; then
  echo "=== 2. pnpm deploy (prod-only node_modules) ==="
  rm -rf payload/api
  pnpm deploy --prod --filter @app/api ./payload/api
  echo "=== 3. physicalize (flatten pnpm symlinks) ==="
  bash scripts/physicalize-payload.sh payload/api/node_modules
  echo "=== 4. drop Prisma leftovers (engine ran on glibc only — replaced by sqlite3) ==="
  rm -rf payload/api/node_modules/@prisma payload/api/node_modules/.prisma payload/api/node_modules/prisma
  echo "=== 5. swap sqlite3 native binary → linux-arm64 (docker/QEMU target) ==="
  # On Android the addon is loaded from jniLibs via ANDROID_NATIVE_LIB_DIR, so
  # the payload copy only needs to satisfy the Docker arm64 test bench.
  curl -sL "$SQLITE3_ARM64_URL" -o /tmp/sqlite3-arm64.tar.gz
  tar xzf /tmp/sqlite3-arm64.tar.gz -C /tmp
  mkdir -p payload/api/node_modules/sqlite3/build/Release
  cp /tmp/build/Release/node_sqlite3.node payload/api/node_modules/sqlite3/build/Release/node_sqlite3.node
  rm -rf /tmp/build /tmp/sqlite3-arm64.tar.gz
fi

echo "=== 6. refresh dist inside payload ==="
rm -rf payload/api/dist
cp -r apps/api/dist payload/api/dist

echo "=== 7. refresh web static export ==="
rm -rf payload/web
mkdir -p payload/web
cp -r apps/web/out/. payload/web/

echo "=== 8. fresh seeded DB ==="
rm -f payload/data/liteerp.sqlite payload/data/liteerp.sqlite-wal payload/data/liteerp.sqlite-shm
mkdir -p payload/data
DATABASE_URL="file:$ROOT/payload/data/liteerp.sqlite" pnpm --filter @app/api db:seed

echo "=== 9. drop legacy openssl libs (Prisma-era) ==="
rm -rf payload/lib

echo "=== done ==="
du -sh payload/api payload/web payload/data 2>/dev/null || true
