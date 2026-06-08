param(
    [string]$PackagePath = (Join-Path $PSScriptRoot "..\\dist\\norwegian_shadow.kyt"),
    [string]$GameCampaignPath = "C:\Program Files (x86)\Steam\steamapps\common\Modern Naval Warfare\Var\Scenarios\Packages\Campaigns",
    [string]$UserCampaignPath = (Join-Path $env:USERPROFILE "AppData\\LocalLow\\WaveOps\\ModernNavalWarfare\\Scenarios\\Packages\\Campaigns")
)

$ErrorActionPreference = "Stop"

$resolvedPackage = (Resolve-Path $PackagePath).Path
$packageFileName = [System.IO.Path]::GetFileName($resolvedPackage)
$targets = @($GameCampaignPath, $UserCampaignPath)

foreach ($targetDir in $targets) {
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    Copy-Item -LiteralPath $resolvedPackage -Destination (Join-Path $targetDir $packageFileName) -Force
}

Get-FileHash $resolvedPackage, (Join-Path $GameCampaignPath $packageFileName), (Join-Path $UserCampaignPath $packageFileName) -Algorithm MD5
