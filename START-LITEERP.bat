@echo off
setlocal
rem ==================================================
rem  LiteERP - Khoi dong tren PC (double-click la chay)
rem  Giao dien + API + du lieu: http://localhost:3000
rem  Dong cua so "LiteERP Server" (duoi taskbar) = tat.
rem ==================================================

rem Neu LiteERP da chay san thi chi mo trinh duyet.
powershell -NoProfile -Command "exit [int][bool](Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)"
if %errorlevel%==1 (
  echo LiteERP dang chay san - mo trinh duyet...
) else (
  echo Dang khoi dong LiteERP...
  start "LiteERP Server" /min /D "%~dp0apps\api" node --enable-source-maps dist\src\main
  rem Cho API len (toi da 20 giay) roi moi mo trinh duyet.
  powershell -NoProfile -Command "for($i=0;$i -lt 40;$i++){ try { $r=Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/api/v1/health -TimeoutSec 1; if($r.StatusCode -eq 200){exit 0} } catch {}; Start-Sleep -Milliseconds 500 }"
)

start http://localhost:3000
endlocal
