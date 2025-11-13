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
echo                AI Roleplay Platform - Quick Start
echo  ==================================================================
echo.

:: Check if Node.js is installed
echo [1/3] Checking Node.js installation...
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

:: Check if node_modules exists
echo [2/3] Checking dependencies...
if not exist "node_modules\" (
    color 0E
    echo  [!] Dependencies not found. Installing...
    echo.
    call npm install
    if %ERRORLEVEL% neq 0 (
        color 0C
        echo.
        echo  [X] ERROR: Failed to install dependencies!
        echo  Please run install.bat first.
        echo.
        pause
        exit /b 1
    )
    echo.
    echo  [OK] Dependencies installed successfully!
) else (
    echo  [OK] Dependencies already installed!
)
echo.

:: Check if package-lock.json is newer than node_modules (updates available)
if exist "package-lock.json" (
    for %%i in (node_modules) do set MODULES_DATE=%%~ti
    for %%i in (package-lock.json) do set PACKAGE_DATE=%%~ti
    
    :: Simple check - you might want to run npm install if package.json changed
    echo  [i] Checking for updates...
    echo  If you want to update dependencies, run: npm install
    echo.
)

:: Start the development server
echo [3/3] Starting RolyGem...
echo.
echo  ==================================================================
color 0A
echo  [OK] Ready to launch!
echo  ==================================================================
echo.
echo  Starting development server...
echo  The browser will open automatically in 3 seconds.
echo.
echo  Server URL: http://localhost:5173
echo.
echo  Press Ctrl+C to stop the server.
echo  ==================================================================
echo.

:: Wait 3 seconds then open browser
timeout /t 3 /nobreak >nul
start http://localhost:5173

:: Start the dev server (this will keep running)
call npm run dev
