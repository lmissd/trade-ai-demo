$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$releaseRoot = "D:\trade-ai-demo-customer-package"
$zipPath = "D:\trade-ai-demo-customer-package.zip"

function Write-Step {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Cyan
}

function Copy-IfExists {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    if (-not (Test-Path -LiteralPath $Source)) {
        return
    }

    $parent = Split-Path -Parent $Destination
    if ($parent) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    Copy-Item -LiteralPath $Source -Destination $Destination -Recurse -Force
}

function Copy-DirectoryContents {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    if (-not (Test-Path -LiteralPath $Source)) {
        return
    }

    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $Source "*") -Destination $Destination -Recurse -Force
}

function Remove-PathIfExists {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (Test-Path -LiteralPath $Path) {
        Remove-Item -LiteralPath $Path -Recurse -Force
    }
}

Set-Location $repoRoot

Write-Step "Building web bundle..."
npm run build --workspace @trade-ai-demo/web

Write-Step "Building server bundle..."
npm run build --workspace @trade-ai-demo/server

Write-Step "Preparing release directory..."
Remove-PathIfExists -Path $releaseRoot
New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null

$releaseAppsServer = Join-Path $releaseRoot "apps/server"
$releaseAppsWeb = Join-Path $releaseRoot "apps/web"

New-Item -ItemType Directory -Path $releaseAppsServer -Force | Out-Null
New-Item -ItemType Directory -Path $releaseAppsWeb -Force | Out-Null

Write-Step "Copying runtime assets..."
Copy-DirectoryContents -Source (Join-Path $repoRoot "apps/server/dist") -Destination (Join-Path $releaseAppsServer "dist")
Copy-DirectoryContents -Source (Join-Path $repoRoot "apps/web/dist") -Destination (Join-Path $releaseAppsWeb "dist")
Copy-DirectoryContents -Source (Join-Path $repoRoot "apps/server/node_modules") -Destination (Join-Path $releaseAppsServer "node_modules")
Copy-IfExists -Source (Join-Path $repoRoot "apps/server/prisma/dev.db") -Destination (Join-Path $releaseAppsServer "prisma/dev.db")
Copy-DirectoryContents -Source (Join-Path $repoRoot "uploads") -Destination (Join-Path $releaseRoot "uploads")
Copy-DirectoryContents -Source (Join-Path $repoRoot "pics") -Destination (Join-Path $releaseRoot "pics")
Copy-DirectoryContents -Source (Join-Path $repoRoot "需求") -Destination (Join-Path $releaseRoot "requirements")

$nodeInstall = (Get-Command node).Source | Split-Path -Parent
Copy-DirectoryContents -Source $nodeInstall -Destination (Join-Path $releaseRoot "node")

Write-Step "Writing customer-facing config and launchers..."
$envFile = @"
AI_PROVIDER=deepseek
AI_MODEL=deepseek-v4-flash
AI_BASE_URL=https://api.deepseek.com
AI_API_KEY=
"@
Set-Content -LiteralPath (Join-Path $releaseRoot ".env") -Value $envFile -Encoding UTF8

$launchPs1 = @'
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$nodeExe = Join-Path $root "node/node.exe"
$serverEntry = Join-Path $root "apps/server/dist/index.js"
$healthUrl = "http://127.0.0.1:3001/api/health"
$openUrl = "http://127.0.0.1:3001/documents"
$pidFile = Join-Path $root ".runtime/server.pid"

function Test-Port {
    try {
        return [bool](Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction Stop)
    } catch {
        return $false
    }
}

function Wait-ForHealth {
    param([int]$TimeoutSeconds = 60)

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 3
            if ($response.status -eq "ok") {
                return $true
            }
        } catch {
            Start-Sleep -Seconds 1
        }
    }

    return $false
}

Set-Location $root
New-Item -ItemType Directory -Path (Join-Path $root ".runtime") -Force | Out-Null

if (-not (Test-Path -LiteralPath $nodeExe)) {
    Write-Host "Node runtime not found." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path -LiteralPath $serverEntry)) {
    Write-Host "Server bundle not found." -ForegroundColor Red
    exit 1
}

if (-not (Test-Port)) {
    $serverProcess = Start-Process -FilePath $nodeExe -ArgumentList @($serverEntry) -WorkingDirectory $root -PassThru -WindowStyle Hidden
    Set-Content -LiteralPath $pidFile -Value $serverProcess.Id -Encoding ASCII

    if (-not (Wait-ForHealth)) {
        Write-Host "Demo startup timed out." -ForegroundColor Red
        exit 1
    }
}

$chromeCandidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe"
)

$chrome = $chromeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if ($chrome) {
    Start-Process -FilePath $chrome -ArgumentList $openUrl
} else {
    Start-Process $openUrl
}

Write-Host "Demo started." -ForegroundColor Green
'@
Set-Content -LiteralPath (Join-Path $releaseRoot "start-demo.ps1") -Value $launchPs1 -Encoding UTF8

$launchBat = @'
@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-demo.ps1"
endlocal
'@
Set-Content -LiteralPath (Join-Path $releaseRoot "start-demo.bat") -Value $launchBat -Encoding ASCII

$stopPs1 = @'
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root ".runtime/server.pid"

if (Test-Path -LiteralPath $pidFile) {
    $savedPid = [int](Get-Content -LiteralPath $pidFile -ErrorAction Stop | Select-Object -First 1)

    try {
        Stop-Process -Id $savedPid -Force -ErrorAction Stop
        Write-Host "Demo stopped." -ForegroundColor Green
    } catch {
        Write-Host "Demo process was not running." -ForegroundColor Yellow
    }

    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
} else {
    Write-Host "No saved demo process found." -ForegroundColor Yellow
}
'@
Set-Content -LiteralPath (Join-Path $releaseRoot "stop-demo.ps1") -Value $stopPs1 -Encoding UTF8

$stopBat = @'
@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-demo.ps1"
endlocal
'@
Set-Content -LiteralPath (Join-Path $releaseRoot "stop-demo.bat") -Value $stopBat -Encoding ASCII

$readme = @'
Customer demo package

1. Double-click start-demo.bat.
2. The browser will open the documents demo page automatically.
3. Use the files in pics and requirements for the customer demo.
4. If you want live AI answers, fill in the API key in .env before starting.
'@
Set-Content -LiteralPath (Join-Path $releaseRoot "README.txt") -Value $readme -Encoding UTF8

Write-Step "Cleaning release directory..."
Remove-PathIfExists -Path (Join-Path $releaseAppsServer "package.json")
Remove-PathIfExists -Path (Join-Path $releaseAppsServer "package-lock.json")
Remove-PathIfExists -Path (Join-Path $releaseAppsServer "node_modules/.cache")

Write-Step "Compressing package..."
if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

Compress-Archive -Path (Join-Path $releaseRoot "*") -DestinationPath $zipPath -Force

Write-Host ""
Write-Host "Package created: $zipPath" -ForegroundColor Green
