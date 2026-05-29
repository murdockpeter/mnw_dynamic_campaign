param(
    [string]$SourceDir = (Join-Path $PSScriptRoot "..\\src\\package"),
    [string]$OutputPath = (Join-Path $PSScriptRoot "..\\dist\\norwegian_shadow.kyt")
)

$ErrorActionPreference = "Stop"

$resolvedSource = (Resolve-Path $SourceDir).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
$outputDir = Split-Path -Parent $resolvedOutput

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$manifestPath = Join-Path $resolvedSource "manifest.json"
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json

foreach ($entry in $manifest.content) {
    $contentPath = Join-Path $resolvedSource ($entry.path -replace "/", "\\")
    $entry.hash = (Get-FileHash $contentPath -Algorithm MD5).Hash.ToLower()
}

$manifest | ConvertTo-Json -Depth 6 | Set-Content $manifestPath -Encoding UTF8

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (Test-Path $resolvedOutput) {
    Remove-Item -LiteralPath $resolvedOutput -Force
}

$fileStream = [System.IO.File]::Open($resolvedOutput, [System.IO.FileMode]::CreateNew)
$zip = New-Object System.IO.Compression.ZipArchive($fileStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)

try {
    $null = $zip.CreateEntry("/")

    Get-ChildItem -Path $resolvedSource -Recurse -Directory |
        Sort-Object FullName |
        ForEach-Object {
            $relative = $_.FullName.Substring($resolvedSource.Length + 1).Replace("\", "/").TrimEnd("/") + "/"
            $null = $zip.CreateEntry($relative)
        }

    Get-ChildItem -Path $resolvedSource -Recurse -File |
        Sort-Object FullName |
        ForEach-Object {
            $relative = $_.FullName.Substring($resolvedSource.Length + 1).Replace("\", "/")
            $entry = $zip.CreateEntry($relative, [System.IO.Compression.CompressionLevel]::Optimal)
            $input = [System.IO.File]::OpenRead($_.FullName)
            $output = $entry.Open()
            try {
                $input.CopyTo($output)
            }
            finally {
                $output.Dispose()
                $input.Dispose()
            }
        }
}
finally {
    $zip.Dispose()
    $fileStream.Dispose()
}

Get-FileHash $resolvedOutput -Algorithm MD5
