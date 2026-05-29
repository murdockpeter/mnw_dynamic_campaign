param(
    [string]$PackagePath = (Join-Path $PSScriptRoot "..\\dist\\norwegian_shadow.kyt"),
    [string]$GameCampaignPath = "C:\Program Files (x86)\Steam\steamapps\common\Modern Naval Warfare\Var\Scenarios\Packages\Campaigns",
    [string]$UserCampaignPath = (Join-Path $env:USERPROFILE "AppData\\LocalLow\\WaveOps\\ModernNavalWarfare\\Scenarios\\Packages\\Campaigns")
)

$ErrorActionPreference = "Stop"

$resolvedPackage = (Resolve-Path $PackagePath).Path
$targets = @($GameCampaignPath, $UserCampaignPath)

foreach ($targetDir in $targets) {
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    Copy-Item -LiteralPath $resolvedPackage -Destination (Join-Path $targetDir "norwegian_shadow.kyt") -Force
}

Get-FileHash $resolvedPackage, (Join-Path $GameCampaignPath "norwegian_shadow.kyt"), (Join-Path $UserCampaignPath "norwegian_shadow.kyt") -Algorithm MD5
