param(
    [string]$DbDir = "C:\Program Files (x86)\Steam\steamapps\common\Modern Naval Warfare\Var\DB",
    [string]$OutputDir = (Join-Path $PSScriptRoot "..\\generated\\db"),
    [int]$StringSampleEntries = 5,
    [int]$StringSampleBytes = 65536,
    [int]$StringSampleCount = 20
)

$ErrorActionPreference = "Stop"

function Get-PrintableStrings {
    param(
        [byte[]]$Bytes,
        [int]$MinLength = 4,
        [int]$MaxCount = 20
    )

    $text = [Text.Encoding]::Latin1.GetString($Bytes)
    $matches = [regex]::Matches($text, "[ -~]{$MinLength,}")
    $results = New-Object System.Collections.Generic.List[string]

    foreach ($match in $matches) {
        $value = $match.Value.Trim()
        if ([string]::IsNullOrWhiteSpace($value)) {
            continue
        }
        if (-not $results.Contains($value)) {
            $results.Add($value)
        }
        if ($results.Count -ge $MaxCount) {
            break
        }
    }

    return $results
}

function Read-EntrySampleStrings {
    param(
        [System.IO.Compression.ZipArchiveEntry]$Entry,
        [int]$MaxBytes,
        [int]$MaxCount
    )

    $stream = $Entry.Open()
    try {
        $buffer = New-Object byte[] ([Math]::Min($MaxBytes, [int]$Entry.Length))
        $read = $stream.Read($buffer, 0, $buffer.Length)
        if ($read -le 0) {
            return @()
        }
        if ($read -lt $buffer.Length) {
            $buffer = $buffer[0..($read - 1)]
        }
        return Get-PrintableStrings -Bytes $buffer -MaxCount $MaxCount
    }
    finally {
        $stream.Dispose()
    }
}

function Get-ArchiveInventory {
    param(
        [string]$ArchivePath,
        [int]$SampleEntryCount,
        [int]$SampleBytes,
        [int]$SampleStringCount
    )

    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem

    $archiveFile = Get-Item $ArchivePath
    $zip = [System.IO.Compression.ZipFile]::OpenRead($ArchivePath)

    try {
        $entries = foreach ($entry in $zip.Entries) {
            $topLevel = ($entry.FullName -split "/")[0]
            $extension = [System.IO.Path]::GetExtension($entry.FullName)
            [PSCustomObject]@{
                path = $entry.FullName
                length = $entry.Length
                compressed_length = $entry.CompressedLength
                extension = if ($extension) { $extension } else { "<none>" }
                top_level = if ($topLevel) { $topLevel } else { "<root>" }
            }
        }

        $extensions = $entries |
            Group-Object extension |
            Sort-Object Count -Descending |
            ForEach-Object {
                [PSCustomObject]@{
                    extension = $_.Name
                    count = $_.Count
                }
            }

        $topLevels = $entries |
            Group-Object top_level |
            Sort-Object Count -Descending |
            ForEach-Object {
                [PSCustomObject]@{
                    name = $_.Name
                    count = $_.Count
                }
            }

        $msgSamples = New-Object System.Collections.Generic.List[object]
        foreach ($msgEntry in @($zip.Entries | Where-Object { $_ -and $_.FullName -like "*.msg" } | Select-Object -First $SampleEntryCount)) {
            $sampleStrings = @()
            try {
                $sampleStrings = @(Read-EntrySampleStrings -Entry $msgEntry -MaxBytes $SampleBytes -MaxCount $SampleStringCount)
            }
            catch {
                $sampleStrings = @("<sample-error: $($_.Exception.Message)>")
            }

            $msgSamples.Add([PSCustomObject]@{
                path = $msgEntry.FullName
                length = $msgEntry.Length
                sample_strings = $sampleStrings
            })
        }

        return @{
            archive_name = $archiveFile.Name
            archive_path = $archiveFile.FullName
            archive_size = [int64]$archiveFile.Length
            archive_md5 = (Get-FileHash $archiveFile.FullName -Algorithm MD5).Hash.ToLower()
            entry_count = @($entries).Count
            extensions = @($extensions | ForEach-Object { "$($_.extension):$($_.count)" })
            top_levels = @($topLevels | ForEach-Object { "$($_.name):$($_.count)" })
            msg_samples = @($msgSamples | ForEach-Object { "$($_.path) => " + (($_.sample_strings | Select-Object -First 5) -join " | ") })
            entries = @($entries)
        }
    }
    finally {
        $zip.Dispose()
    }
}

$resolvedDbDir = (Resolve-Path $DbDir).Path
$resolvedOutputDir = [System.IO.Path]::GetFullPath($OutputDir)
New-Item -ItemType Directory -Force -Path $resolvedOutputDir | Out-Null

$archives = Get-ChildItem -Path $resolvedDbDir -File | Where-Object { $_.Extension -in @(".core", ".ais") } | Sort-Object Name
if (-not $archives) {
    throw "No .core or .ais archives found in $resolvedDbDir"
}

$summary = foreach ($archive in $archives) {
    $inventory = Get-ArchiveInventory -ArchivePath $archive.FullName -SampleEntryCount $StringSampleEntries -SampleBytes $StringSampleBytes -SampleStringCount $StringSampleCount
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($archive.Name)

    $jsonPath = Join-Path $resolvedOutputDir "$baseName.summary.json"
    $csvPath = Join-Path $resolvedOutputDir "$baseName.entries.csv"

    $inventory | ConvertTo-Json -Depth 8 | Set-Content $jsonPath -Encoding UTF8
    $inventory.entries | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8

    [PSCustomObject]@{
        archive_name = $inventory.archive_name
        archive_md5 = $inventory.archive_md5
        entry_count = $inventory.entry_count
        top_levels = ($inventory.top_levels) -join "; "
        summary_json = $jsonPath
        entries_csv = $csvPath
    }
}

$summaryPath = Join-Path $resolvedOutputDir "db_index.json"
$dbIndex = foreach ($item in $summary) {
    $archiveSummary = Get-Content $item.summary_json -Raw | ConvertFrom-Json
    [PSCustomObject]@{
        archive_name = $archiveSummary.archive_name
        archive_md5 = $archiveSummary.archive_md5
        entry_count = $archiveSummary.entry_count
        top_levels = ($archiveSummary.top_levels) -join "; "
        summary_json = $item.summary_json
        entries_csv = $item.entries_csv
    }
}

$dbIndex | ConvertTo-Json -Depth 6 | Set-Content $summaryPath -Encoding UTF8

$summary
