@echo off
setlocal

cd /d "%~dp0"

set "OUTPUT_DIR=%CD%\release"

echo.
echo === Codex Airbar portable package ===
echo Project: %CD%
echo Output : %OUTPUT_DIR%
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found on PATH.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 goto :failed
)

if exist "%OUTPUT_DIR%" (
  echo Cleaning previous output...
  rmdir /s /q "%OUTPUT_DIR%"
)
mkdir "%OUTPUT_DIR%"
if errorlevel 1 goto :failed

echo Building portable package...
call npm run build:renderer
if errorlevel 1 goto :failed

call npm run protect:main
if errorlevel 1 goto :failed

set "CSC_IDENTITY_AUTO_DISCOVERY=false"
call npx electron-builder --win portable
if errorlevel 1 goto :failed

echo.
echo [OK] Portable package generated in:
echo %OUTPUT_DIR%
echo.
pause
exit /b 0

:failed
echo.
echo [ERROR] Package failed.
echo If the error says "Cannot create symbolic link", run this bat as administrator or enable Windows Developer Mode.
echo.
pause
exit /b 1
