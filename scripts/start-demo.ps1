$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dashboardUrl = "http://127.0.0.1:5173/dashboard"
$healthUrl = "http://127.0.0.1:3001/api/health"

function Test-TcpPort {
    param (
        [int]$Port
    )

    try {
        return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop)
    } catch {
        return $false
    }
}

function Wait-ForPort {
    param (
        [int]$Port,
        [int]$TimeoutSeconds = 45
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-TcpPort -Port $Port) {
            return $true
        }

        Start-Sleep -Seconds 1
    }

    return $false
}

Set-Location $root

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "npm was not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path (Join-Path $root "node_modules"))) {
    Write-Host "Installing dependencies for first launch..." -ForegroundColor Yellow
    npm install
}

$webRunning = Test-TcpPort -Port 5173
$serverRunning = Test-TcpPort -Port 3001

if (-not ($webRunning -and $serverRunning)) {
    Write-Host "Starting web and server dev services..." -ForegroundColor Cyan

    $command = "Set-Location '$root'; npm run dev"
    Start-Process -FilePath "powershell.exe" `
        -WorkingDirectory $root `
        -ArgumentList @("-NoExit", "-NoProfile", "-Command", $command)

    $webReady = Wait-ForPort -Port 5173
    $serverReady = Wait-ForPort -Port 3001

    if (-not ($webReady -and $serverReady)) {
        Write-Host "Startup timed out. Please check the new terminal window for errors." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Services are already running. Opening the dashboard directly." -ForegroundColor Green
}

Start-Process $dashboardUrl

Write-Host "Demo started." -ForegroundColor Green
Write-Host "Dashboard: $dashboardUrl"
Write-Host "Health: $healthUrl"
