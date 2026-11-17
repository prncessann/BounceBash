@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 LTS, reopen this window, and run this file again.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci
  if errorlevel 1 (
    echo Dependency installation failed. See README.md for troubleshooting.
    pause
    exit /b 1
  )
)
call npm run setup
if errorlevel 1 (
  pause
  exit /b 1
)
echo Open http://localhost:3000 in your browser after the server starts.
call npm start
pause
