param(
    [int]$Port = 8765,
    [switch]$SkipTests,
    [switch]$SkipBuild,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$uiIndex = Join-Path $root "ui\\index.html"
$uiData = Join-Path $root "ui\\data\\sample-runtime.json"
$buildScript = Join-Path $PSScriptRoot "build.ps1"
$runUiScript = Join-Path $PSScriptRoot "run-ui.ps1"
$exportUiScript = Join-Path $PSScriptRoot "export-ui-state.py"

if (-not (Test-Path $uiIndex)) {
    throw "Missing UI file: $uiIndex"
}

if (-not (Test-Path $uiData)) {
    throw "Missing UI data file: $uiData"
}

Push-Location $root
try {
    if (-not $SkipTests) {
        Write-Host ""
        Write-Host "== Running persistence smoke test ==" -ForegroundColor Cyan
        python -m unittest tests.test_persistence_smoke
    }

    if (-not $SkipBuild) {
        Write-Host ""
        Write-Host "== Building MNW package ==" -ForegroundColor Cyan
        powershell -ExecutionPolicy Bypass -File $buildScript
    }

    Write-Host ""
    Write-Host "== Exporting live UI state ==" -ForegroundColor Cyan
    python $exportUiScript

    Write-Host ""
    Write-Host "== Starting UI server ==" -ForegroundColor Cyan
    if ($NoBrowser) {
        powershell -ExecutionPolicy Bypass -File $runUiScript -Port $Port
    }
    else {
        powershell -ExecutionPolicy Bypass -File $runUiScript -Port $Port -OpenBrowser
    }
}
finally {
    Pop-Location
}
