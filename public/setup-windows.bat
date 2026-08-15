@echo off
REM Billboard System - Local Setup Script (Batch)
REM Run as Administrator

echo ===============================================
echo   Billboard System - Local Environment Setup
echo ===============================================
echo.

REM Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Please run this script as Administrator!
    pause
    exit /b 1
)

REM Create project directory
set PROJECT_DIR=C:\billboard-local
echo Creating project directory: %PROJECT_DIR%
mkdir "%PROJECT_DIR%" 2>nul
cd /d "%PROJECT_DIR%"

echo.
echo [1/3] Installing Supabase CLI...
winget install Supabase.CLI --accept-source-agreements --accept-package-agreements

echo.
echo [2/3] Checking Docker...
docker --version >nul 2>&1
if %errorLevel% neq 0 (
    echo Installing Docker Desktop...
    winget install Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
    echo Please restart your computer after Docker installation and run this script again.
    pause
    exit /b 0
)

echo.
echo [3/3] Initializing Supabase local project...
call supabase init
call supabase start

echo.
echo ===============================================
echo   Setup Complete!
echo ===============================================
echo.
echo API URL:      http://localhost:54321
echo Database URL: postgresql://postgres:postgres@localhost:54322/postgres
echo Studio URL:   http://localhost:54323
echo.
echo Next steps:
echo 1. Copy your database_full_restore.sql to %PROJECT_DIR%
echo 2. Run: psql -U postgres -d postgres -h localhost -p 54322 -f database_full_restore.sql
echo 3. Copy full_data_import.sql to %PROJECT_DIR%
echo 4. Run: psql -U postgres -d postgres -h localhost -p 54322 -f full_data_import.sql
echo.
pause
