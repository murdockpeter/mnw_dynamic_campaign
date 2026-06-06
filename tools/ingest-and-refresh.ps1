param(
    [string]$CampaignId = "silent_meridian",
    [string]$ResultPath = (Join-Path $PSScriptRoot "..\\parsers\\manual_result_followup.json"),
    [double]$AdvanceHours = 24.0
)

$ErrorActionPreference = "Stop"

$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$ingestScript = Join-Path $PSScriptRoot "ingest-result.py"
$refreshScript = Join-Path $PSScriptRoot "refresh-ui-state.ps1"

Push-Location $root
try {
    Write-Host ""
    Write-Host "== Ingesting mission result ==" -ForegroundColor Cyan
    python $ingestScript --campaign-id $CampaignId --result $ResultPath --advance-hours $AdvanceHours

    Write-Host ""
    Write-Host "== Refreshing UI state ==" -ForegroundColor Cyan
    powershell -ExecutionPolicy Bypass -File $refreshScript -CampaignId $CampaignId
}
finally {
    Pop-Location
}
