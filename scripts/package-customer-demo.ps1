$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$releaseRoot = "D:\trade-ai-demo-customer-package"
$zipPath = "D:\trade-ai-demo-customer-package.zip"

function Write-Step {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Cyan
}

function Ensure-ParentDir {
    param([Parameter(Mandatory = $true)][string]$Path)

    $parent = Split-Path -Parent $Path
    if ($parent) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
}

function Copy-IfExists {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    if (-not (Test-Path -LiteralPath $Source)) {
        return
    }

    Ensure-ParentDir -Path $Destination
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

function Get-NodeInstallDir {
    $nodeCmd = Get-Command node -ErrorAction Stop
    return Split-Path -Parent $nodeCmd.Source
}

Set-Location $repoRoot

Write-Step "Building web bundle..."
$env:VITE_CUSTOMER_MODE = "1"
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
Copy-DirectoryContents -Source (Join-Path $repoRoot "需求") -Destination (Join-Path $releaseRoot "需求")

$nodeInstall = Get-NodeInstallDir
Copy-DirectoryContents -Source $nodeInstall -Destination (Join-Path $releaseRoot "node")

Write-Step "Writing customer-facing config and launchers..."
$envFile = @"
SERVER_PORT=3001
DATABASE_URL="file:./apps/server/prisma/dev.db"
AI_PROVIDER=deepseek
AI_MODEL=deepseek-v4-flash
AI_BASE_URL=https://api.deepseek.com
AI_API_KEY=
DEMO_SCENARIO_NAME=default-zambia-demo
DEMO_ORIGIN=中国
DEMO_PRODUCT_NAME=铜缆演示货物
DEMO_CUSTOMER_NAME=赞比亚客户 ABC Trading
DEMO_SUPPLIER_NAME=中国供应商 China Supplier Co., Ltd.
DEMO_DESTINATION_WAREHOUSE=赞比亚仓库
DEMO_TOTAL_QUANTITY=100
DEMO_UNIT=箱
DEMO_PLANNED_OUTBOUND_QUANTITY=20
DEMO_AMOUNT=50000
DEMO_CURRENCY=USD
"@
Set-Content -LiteralPath (Join-Path $releaseRoot ".env") -Value $envFile -Encoding UTF8

$launchPs1 = @'
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$nodeExe = Join-Path $root "node/node.exe"
$serverEntry = Join-Path $root "apps/server/dist/index.js"
$openUrl = "http://127.0.0.1:3001"
$healthUrl = "http://127.0.0.1:3001/api/health"
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

Start-Process $openUrl
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
客户演示包使用说明

1. 双击 `start-demo.bat`。
2. 系统会自动启动本地演示并打开浏览器。
3. 打开后可直接浏览合同、单据、库存、AI 助手和“测试资料”页面。
4. “测试资料”里已经附带需求截图和测试单据图片，可直接用于上传演示。
5. 如果需要启用 DeepSeek 实时回答，请在启动前填写包内 `.env` 的 `AI_API_KEY`。
6. 演示结束后，双击 `stop-demo.bat` 停止服务。
'@
Set-Content -LiteralPath (Join-Path $releaseRoot "README.txt") -Value $readme -Encoding UTF8
Set-Content -LiteralPath (Join-Path $releaseRoot "使用说明.txt") -Value $readme -Encoding UTF8

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
