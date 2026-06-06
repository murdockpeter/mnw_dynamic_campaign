param(
    [int]$Port = 8765,
    [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"

$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$uiIndex = Join-Path $root "ui\\index.html"
$uiData = Join-Path $root "ui\\data\\sample-runtime.json"

if (-not (Test-Path $uiIndex)) {
    throw "Missing UI file: $uiIndex"
}

if (-not (Test-Path $uiData)) {
    throw "Missing UI data file: $uiData"
}

Write-Host "Repo root: $root"
Write-Host "Serving UI on http://localhost:$Port/ui/index.html"
Write-Host "Press Ctrl+C to stop."

if ($OpenBrowser) {
    Start-Process "http://localhost:$Port/ui/index.html"
}

python -m http.server $Port --directory $root
