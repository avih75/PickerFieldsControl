@echo off
echo [setup] Creating directory structure...
mkdir src\types 2>nul
mkdir src\services 2>nul
mkdir src\utils 2>nul
mkdir src\Control 2>nul
mkdir src\Hub 2>nul
mkdir src\Action 2>nul
mkdir src\components\control 2>nul
mkdir src\components\hub 2>nul
mkdir src\__mocks__ 2>nul
mkdir src\__tests__ 2>nul
mkdir static 2>nul
mkdir img 2>nul
echo [setup] Running node setup-dirs.js to write source files...
node setup-dirs.js
echo [setup] Installing npm dependencies...
call npm install
echo [setup] Done! Run "npm run build:dev" to build, "npm test" to run tests.
pause
