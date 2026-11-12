@echo off
setlocal
title Slendo Cord
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. Install it from https://nodejs.org and try again.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies. This only happens the first time...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Starting local server at http://localhost:3000
start "Open Slendo Cord" cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3000"
call npm run dev

echo.
echo Server stopped.
pause
