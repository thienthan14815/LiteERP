#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
Set-Location $rootDir

Write-Host "==> Starting infrastructure (postgres, redis, minio)..." -ForegroundColor Cyan
docker compose up -d postgres redis minio

Write-Host "==> Waiting for postgres..." -ForegroundColor Cyan
do {
    Start-Sleep -Seconds 1
    $ready = docker compose exec -T postgres pg_isready -U app -d app 2>$null
} while ($LASTEXITCODE -ne 0)

Write-Host "==> Installing deps (if needed)..." -ForegroundColor Cyan
pnpm install

Write-Host "==> Running Prisma migrate..." -ForegroundColor Cyan
pnpm prisma:migrate

Write-Host "==> Starting api + web (dev)..." -ForegroundColor Cyan
pnpm dev
