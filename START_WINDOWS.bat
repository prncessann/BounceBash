@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 LTS, reopen this window, and run this file again.
  pause
  exit /b 1
)
node -e "const [major,minor]=process.versions.node.split('.').map(Number);process.exit(major>=22&&major<25&&(major!==22||minor>=13)?0:1)"
if errorlevel 1 (
  echo Install a supported Node.js version from 22.13 through 24.x, then reopen this window.
  pause
  exit /b 1
)
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm.cmd was not found. Repair the Node.js installation and verify PATH.
  pause
  exit /b 1
)
node -e "for(const name of Object.keys(require('./package.json').dependencies))require(name);new (require('better-sqlite3'))(':memory:').close()" >nul 2>nul
if errorlevel 1 (
  call npm ci
  if errorlevel 1 (
    echo Dependency installation failed. Check npm registry access and the Node.js version, then run npm ci in this folder for details.
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
if errorlevel 1 echo Startup failed. Check the database path and server error above, then follow README.md.
pause
