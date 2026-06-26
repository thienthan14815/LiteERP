#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Starting infrastructure (postgres, redis, minio)..."
docker compose up -d postgres redis minio

echo "==> Waiting for postgres..."
until docker compose exec -T postgres pg_isready -U app -d app >/dev/null 2>&1; do
  sleep 1
done

echo "==> Installing deps (if needed)..."
pnpm install

echo "==> Running Prisma migrate..."
pnpm prisma:migrate || true

echo "==> Starting api + web (dev)..."
pnpm dev
