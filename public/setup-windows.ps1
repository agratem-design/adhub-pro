# Billboard System - Local Setup Script (PowerShell)
# Run as Administrator

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Billboard System - Local Environment Setup  " -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as admin
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Please run this script as Administrator!" -ForegroundColor Red
    exit 1
}

# Create project directory
$projectDir = "C:\billboard-local"
Write-Host "Creating project directory: $projectDir" -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $projectDir | Out-Null
Set-Location $projectDir

# Check for winget
$wingetPath = Get-Command winget -ErrorAction SilentlyContinue
if (-not $wingetPath) {
    Write-Host "winget not found. Please install App Installer from Microsoft Store." -ForegroundColor Red
    exit 1
}

# Install Supabase CLI
Write-Host ""
Write-Host "[1/3] Installing Supabase CLI..." -ForegroundColor Green
winget install Supabase.CLI --accept-source-agreements --accept-package-agreements

# Install Docker Desktop (required for Supabase local)
Write-Host ""
Write-Host "[2/3] Checking Docker Desktop..." -ForegroundColor Green
$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
    Write-Host "Installing Docker Desktop..." -ForegroundColor Yellow
    winget install Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
    Write-Host "Please restart your computer after Docker installation and run this script again." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 0
}

# Initialize Supabase project
Write-Host ""
Write-Host "[3/3] Initializing Supabase local project..." -ForegroundColor Green
supabase init

Write-Host ""
Write-Host "Starting Supabase services..." -ForegroundColor Yellow
supabase start

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "  Setup Complete!                              " -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
Write-Host "API URL:      http://localhost:54321" -ForegroundColor Cyan
Write-Host "Database URL: postgresql://postgres:postgres@localhost:54322/postgres" -ForegroundColor Cyan
Write-Host "Studio URL:   http://localhost:54323" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Copy your database_full_restore.sql to $projectDir"
Write-Host "2. Run: psql -U postgres -d postgres -h localhost -p 54322 -f database_full_restore.sql"
Write-Host "3. Copy full_data_import.sql to $projectDir"  
Write-Host "4. Run: psql -U postgres -d postgres -h localhost -p 54322 -f full_data_import.sql"
Write-Host ""
Read-Host "Press Enter to exit"
