param(
    [string]$CampaignId = "silent_meridian"
)

$ErrorActionPreference = "Stop"

$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$exportUiScript = Join-Path $PSScriptRoot "export-ui-state.py"

Push-Location $root
try {
    python $exportUiScript --campaign-id $CampaignId
}
finally {
    Pop-Location
}
