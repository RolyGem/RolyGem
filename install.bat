@echo off
color 0B
cls

echo.
echo  ==================================================================
echo   ____       _       ____                 
echo  ^|  _ \ ___ ^| ^|_   _^/ ___^|  ___ _ __ ___  
echo  ^| ^|_) / _ \^| ^| ^| ^| ^| ^|  _ / _ \ '_ ` _ \ 
echo  ^|  _ ^< (_) ^| ^| ^|_^| ^| ^|_^| ^|  __/ ^| ^| ^| ^| ^|
echo  ^|_^| \_\___/^|_^|\__, ^|\____^|\___ ^|_^| ^|_^| ^|_^|
echo                ^|___/                        
echo  ==================================================================
echo              AI Roleplay Platform - Installation Script
echo  ==================================================================
echo.

:: Check if Node.js is installed
echo [1/4] Checking Node.js installation...
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo  [X] ERROR: Node.js is not installed!
    echo  Please download and install Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo  [OK] Node.js found: %NODE_VERSION%
echo.

:: Install dependencies
echo [2/4] Installing dependencies...
echo  Please wait, this may take a few minutes...
echo.
call npm install
if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo  [X] ERROR: Failed to install dependencies!
    echo.
    pause
    exit /b 1
)
echo.
echo  [OK] Dependencies installed successfully!
echo.

:: Build the project
echo [3/4] Building the project...
echo  Optimizing for production...
echo.
call npm run build
if %ERRORLEVEL% neq 0 (
    color 0E
    echo.
    echo  [!] WARNING: Build failed, but you can still run in dev mode.
    echo.
)
echo.
echo  [OK] Build completed!
echo.

:: Start the development server
echo [4/4] Starting development server...
echo.
echo  ==================================================================
color 0A
echo  [OK] Installation complete!
echo  ==================================================================
echo.
echo  Starting RolyGem...
echo  The browser will open automatically in 5 seconds.
echo.
echo  Server URL: http://localhost:5173
echo.
echo  Press Ctrl+C to stop the server.
echo  ==================================================================
echo.

:: Wait 2 seconds then open browser
timeout /t 2 /nobreak >nul
start http://localhost:5173

:: Start the dev server (this will keep running)
call npm run dev
