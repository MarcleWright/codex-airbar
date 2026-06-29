@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Please install Node.js first.
  pause
  exit /b 1
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo Electron is not installed yet. Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo Failed to install dependencies.
    pause
    exit /b 1
  )
)

echo Starting Vite dev server on http://127.0.0.1:5178 ...
start "Codex Airbar Vite" /min cmd /c "npm run dev"

echo Waiting for Vite dev server...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$deadline=(Get-Date).AddSeconds(30); do { try { Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:5178' -TimeoutSec 1 > $null; exit 0 } catch { Start-Sleep -Milliseconds 500 } } while ((Get-Date) -lt $deadline); exit 1"
if errorlevel 1 (
  echo Vite dev server did not become ready.
  pause
  exit /b 1
)

set VITE_DEV_SERVER_URL=http://127.0.0.1:5178
call npx electron .
if errorlevel 1 (
  echo Codex Airbar dev app exited with an error.
  pause
  exit /b 1
)
