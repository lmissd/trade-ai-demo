$ErrorActionPreference = "SilentlyContinue"

$root = Split-Path -Parent $PSScriptRoot
$ports = @(5173, 3001)

$repoProcesses = Get-CimInstance Win32_Process | Where-Object {
    ($_.Name -in @("cmd.exe", "powershell.exe")) -and
    $_.CommandLine -and
    $_.CommandLine.Contains($root) -and
    $_.CommandLine.Contains("npm run dev")
}

foreach ($process in $repoProcesses) {
    taskkill /PID $process.ProcessId /T /F | Out-Null
}

foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($connection in $connections) {
        taskkill /PID $connection.OwningProcess /T /F | Out-Null
    }
}

Write-Host "Requested shutdown for demo services on ports 5173 and 3001." -ForegroundColor Green
