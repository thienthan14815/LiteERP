# LiteERP auto-install — Windows PowerShell
#
# Idempotent bootstrapper. Chạy từ repo root:
#   pwsh -File .claude/skills/liteerp-install/install.ps1
#
# Flags:
#   -SkipDocker    Bỏ qua bước docker compose up (khi user tự chạy hạ tầng)
#   -SkipDev       Cài xong nhưng không khởi động dev server
#   -ResetDb       docker compose down -v trước (XOÁ HẾT DỮ LIỆU)

param(
  [switch]$SkipDocker,
  [switch]$SkipDev,
  [switch]$ResetDb
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
Set-Location $repoRoot
Write-Host "==> Repo root: $repoRoot" -ForegroundColor Cyan

function Fail($msg) {
  Write-Host "[FAIL] $msg" -ForegroundColor Red
  exit 1
}
function Step($msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

# ---- 0. Pre-flight ----
Step "Pre-flight — kiểm tra marker của repo"
foreach ($f in @("package.json","pnpm-workspace.yaml","apps/api/package.json","apps/web/package.json","docker-compose.yml","apps/api/prisma/schema.prisma")) {
  if (-not (Test-Path $f)) { Fail "Không thấy $f — bạn có đang ở repo root không?" }
}

# ---- 1. Prereqs ----
Step "Kiểm tra Node / pnpm / Docker"
try { $nodeV = (node --version) } catch { Fail "Node chưa cài. Cần Node >= 20." }
$nodeMajor = [int]($nodeV -replace "v(\d+)\..*",'$1')
if ($nodeMajor -lt 20) { Fail "Node $nodeV — cần >= 20.0.0" }

try { $pnpmV = (pnpm --version) } catch {
  Write-Host "pnpm chưa có — bật corepack..."
  corepack enable
  corepack prepare pnpm@9.0.0 --activate
  $pnpmV = (pnpm --version)
}

try { docker --version | Out-Null } catch { Fail "Docker chưa cài / chưa chạy." }
try { docker compose version | Out-Null } catch { Fail "Docker Compose v2 chưa có." }
Write-Host "Node $nodeV / pnpm $pnpmV / docker OK"

# ---- 2. Install deps ----
Step "pnpm install"
pnpm install

# ---- 3. .env ----
Step ".env"
$envPath = Join-Path $repoRoot ".env"
$tpl = Join-Path $PSScriptRoot ".env.template"
if (-not (Test-Path $envPath)) {
  Write-Host ".env chưa có — sinh mới từ template"
  Copy-Item $tpl $envPath
  # Sinh JWT secrets ngẫu nhiên
  $rand = { -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) }) }
  $access = & $rand
  $refresh = & $rand
  (Get-Content $envPath) `
    -replace "JWT_ACCESS_SECRET=REPLACE_WITH_RANDOM_64_HEX", "JWT_ACCESS_SECRET=$access" `
    -replace "JWT_REFRESH_SECRET=REPLACE_WITH_RANDOM_64_HEX", "JWT_REFRESH_SECRET=$refresh" `
    | Set-Content $envPath -Encoding utf8
  Write-Host ".env: JWT secrets sinh mới OK"
} else {
  Write-Host ".env đã có — giữ nguyên"
}

# ---- 4. Docker ----
if (-not $SkipDocker) {
  if ($ResetDb) {
    Step "Reset — docker compose down -v (XOÁ VOLUMES)"
    docker compose down -v
  }
  Step "docker compose up -d postgres redis minio"
  docker compose up -d postgres redis minio

  Step "Chờ healthcheck (tối đa 60s)"
  $deadline = (Get-Date).AddSeconds(60)
  $services = @("refurb-postgres","refurb-redis","refurb-minio")
  while ((Get-Date) -lt $deadline) {
    $ok = $true
    foreach ($s in $services) {
      $status = docker inspect --format='{{.State.Health.Status}}' $s 2>$null
      if ($status -ne "healthy") { $ok = $false; break }
    }
    if ($ok) { Write-Host "Tất cả healthy" -ForegroundColor Green; break }
    Start-Sleep -Seconds 2
  }
  if (-not $ok) { Write-Host "[WARN] Có service chưa healthy sau 60s — tiếp tục" -ForegroundColor Yellow }

  # MinIO bucket
  Step "Tạo MinIO bucket 'refurb-attachments' (idempotent)"
  $mc = Get-Command mc -ErrorAction SilentlyContinue
  if ($mc) {
    mc alias set liteerp http://localhost:9000 minio minio12345 2>$null | Out-Null
    mc mb --ignore-existing liteerp/refurb-attachments 2>$null | Out-Null
  } else {
    Write-Host "[INFO] 'mc' không có — vào http://localhost:9001 (minio / minio12345) tạo bucket 'refurb-attachments' thủ công nếu cần." -ForegroundColor Yellow
  }
} else {
  Write-Host "-SkipDocker — bỏ qua hạ tầng"
}

# ---- 5. Prisma ----
Step "prisma generate"
pnpm --filter "@app/api" prisma generate
if ($LASTEXITCODE -ne 0) {
  Write-Host "[HINT] Nếu lỗi EPERM query_engine-windows.dll.node → tắt hết pnpm dev:api rồi chạy lại." -ForegroundColor Yellow
  Fail "prisma generate failed"
}

Step "prisma migrate deploy"
pnpm --filter "@app/api" prisma migrate deploy

Step "prisma seed"
pnpm --filter "@app/api" prisma:seed

# ---- 6. Dev servers ----
if ($SkipDev) {
  Write-Host ""
  Write-Host "==> Cài đặt xong (bỏ qua khởi động dev)." -ForegroundColor Green
  Write-Host "Chạy bằng tay:  pnpm dev"
  exit 0
}

Step "Khởi động pnpm dev (background)"
$log = Join-Path $repoRoot ".claude\skills\liteerp-install\pnpm-dev.log"
Start-Process -FilePath "pnpm" -ArgumentList "dev" -WorkingDirectory $repoRoot -RedirectStandardOutput $log -WindowStyle Hidden
Write-Host "Log: $log"

Step "Chờ API :3001 lên (tối đa 90s)"
$deadline = (Get-Date).AddSeconds(90)
$ready = $false
while ((Get-Date) -lt $deadline) {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    if ($r.StatusCode -eq 200) { $ready = $true; break }
  } catch { Start-Sleep -Seconds 2 }
}

Write-Host ""
if ($ready) {
  Write-Host "==> DONE" -ForegroundColor Green
  Write-Host "Web:            http://localhost:3000"
  Write-Host "API:            http://localhost:3001/api/v1"
  Write-Host "MinIO Console:  http://localhost:9001  (minio / minio12345)"
  Write-Host "Login:          admin@example.com / admin1234"
} else {
  Write-Host "[WARN] API chưa trả 200 sau 90s. Xem $log để chẩn đoán." -ForegroundColor Yellow
}
