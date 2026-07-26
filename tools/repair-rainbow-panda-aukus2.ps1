param(
    [string]$InputPackage = "C:\Program Files (x86)\Steam\steamapps\common\Modern Naval Warfare\Var\Scenarios\Packages\Campaigns\campaigns.kyt",
    [string]$OutputPackage = (Join-Path $PSScriptRoot "..\dist\campaigns-rainbow-panda-aukus2-fixed.kyt")
)

$ErrorActionPreference = "Stop"

$missionPath = "rainbow_panda/m2_aukus.mis"
$manifestPath = "manifest.json"
$resolvedInput = (Resolve-Path -LiteralPath $InputPackage).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPackage)
$outputDirectory = Split-Path -Parent $resolvedOutput

if ($resolvedInput -eq $resolvedOutput) {
    throw "InputPackage and OutputPackage must be different. This repair never overwrites the stock package."
}

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Read-ZipEntryBytes {
    param([System.IO.Compression.ZipArchiveEntry]$Entry)

    $stream = $Entry.Open()
    $memory = New-Object System.IO.MemoryStream
    try {
        $stream.CopyTo($memory)
        return $memory.ToArray()
    }
    finally {
        $memory.Dispose()
        $stream.Dispose()
    }
}

function Get-Md5 {
    param([byte[]]$Bytes)

    $md5 = [System.Security.Cryptography.MD5]::Create()
    try {
        return ([System.BitConverter]::ToString($md5.ComputeHash($Bytes))).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $md5.Dispose()
    }
}

function Replace-RequiredText {
    param(
        [string]$Text,
        [string]$Old,
        [string]$New,
        [string]$Description
    )

    $normalizedOld = $Old.Replace("`r`n", "`n")
    $normalizedNew = $New.Replace("`r`n", "`n")

    if (-not $Text.Contains($normalizedOld)) {
        throw "Cannot apply ${Description}: the expected stock mission block was not found. The game package may already be patched or may be from an unsupported version."
    }

    return $Text.Replace($normalizedOld, $normalizedNew)
}

$inputStream = [System.IO.File]::OpenRead($resolvedInput)
$inputZip = New-Object System.IO.Compression.ZipArchive($inputStream, [System.IO.Compression.ZipArchiveMode]::Read, $false)

try {
    $missionEntry = $inputZip.GetEntry($missionPath)
    $manifestEntry = $inputZip.GetEntry($manifestPath)
    if ($null -eq $missionEntry) {
        throw "The input package does not contain $missionPath."
    }
    if ($null -eq $manifestEntry) {
        throw "The input package does not contain $manifestPath."
    }

    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $missionText = $utf8.GetString((Read-ZipEntryBytes $missionEntry))
    $missionText = $missionText.Replace("`r`n", "`n")

    $oldSchirraId = @'
#USNS Wally Schirra DB ID
schirra_id = 452
'@
    $missionText = Replace-RequiredText $missionText $oldSchirraId "" "obsolete USNS Wally Schirra database declaration removal"

    $oldObjectives = @'
objectives = [
    #Primaries
    Obj(_objectives["primary_disable_the_aircraft_carrier"], True).SetStatus(ObjectiveStatus.InProgress),
    #Secondaries
    Obj(_objectives["secondary_disable_the_cg"], False).SetStatus(ObjectiveStatus.InProgress),
    Obj(_objectives["secondary_disable_the_take"], False).SetStatus(ObjectiveStatus.InProgress)
]
'@
    $newObjectives = @'
objectives = [
    #Primaries
    Obj(_objectives["primary_disable_the_aircraft_carrier"], True).SetStatus(ObjectiveStatus.InProgress),
    #Secondaries
    Obj(_objectives["secondary_disable_the_cg"], False).SetStatus(ObjectiveStatus.InProgress)
]
'@
    $missionText = Replace-RequiredText $missionText $oldObjectives $newObjectives "stale supply-ship objective removal"

    $oldSchirra = @'
schirra_props = Element.Props.FromDatabaseID(us_fact, "USNS Wally Schirra", ElementCategory.Ship, schirra_id, csg_spawn_pos)
schirra_element = Element(schirra_props).SetHVU(True)
schirra_spawn_process = _P.Element.Spawn(player_spawn_process, schirra_element, csg_spawn_pos)

'@
    $missionText = Replace-RequiredText $missionText $oldSchirra "" "unavailable USNS Wally Schirra removal"

    $oldChamplainSpawn = @'
champlain_props = Element.Props.FromDatabaseID(us_fact, "USS Lake Champlain", ElementCategory.Ship, champlain_id, csg_spawn_pos)
champlain_element = Element(champlain_props).SetHVU(True)
champlain_spawn_process = _P.Element.Spawn(player_spawn_process, champlain_element, csg_spawn_pos)
'@
    $newChamplainSpawn = @'
champlain_spawn_pos = GC(14.57900,117.61500)
champlain_props = Element.Props.FromDatabaseID(us_fact, "USS Lake Champlain", ElementCategory.Ship, champlain_id, champlain_spawn_pos)
champlain_element = Element(champlain_props).SetHVU(True)
champlain_spawn_process = _P.Element.Spawn(player_spawn_process, champlain_element, champlain_spawn_pos)
'@
    $missionText = Replace-RequiredText $missionText $oldChamplainSpawn $newChamplainSpawn "cruiser spawn separation"

    $oldChafeeSpawn = @'
chafee_props = Element.Props.FromDatabaseID(us_fact, "USS Chafee", ElementCategory.Ship, chafee_id, csg_spawn_pos)
chafee_element = Element(chafee_props)
chafee_spawn_process = _P.Element.Spawn(player_spawn_process, chafee_element, csg_spawn_pos)
'@
    $newChafeeSpawn = @'
chafee_spawn_pos = GC(14.53500,117.55500)
chafee_props = Element.Props.FromDatabaseID(us_fact, "USS Chafee", ElementCategory.Ship, chafee_id, chafee_spawn_pos)
chafee_element = Element(chafee_props)
chafee_spawn_process = _P.Element.Spawn(player_spawn_process, chafee_element, chafee_spawn_pos)
'@
    $missionText = Replace-RequiredText $missionText $oldChafeeSpawn $newChafeeSpawn "destroyer spawn separation"

    $oldFormation = @'
##
# CSG Squadron
##
squad_elements = [vinson_element, champlain_element, schirra_element, chafee_element, seahawk_element]

asw_formation_props = ASWFormation.ASWFormationProps()
asw_formation_props.SetCourse(200.0)
csg_squad = Squadron(us_fact, "CSG", squad_elements, csg_spawn_pos, asw_formation_props)
csg_squadrom_plot = _P.Squadron.Plot(taylor_spawn_process, csg_squad, Waypoint(csg_end_pos))
'@
    $newFormation = @'
##
# CSG movement
##
# Keep unlike surface and air elements out of a single ASWFormation. Mixed
# formations are fragile during mission construction and snapshot creation.
vinson_plot = _P.Element.Plot(taylor_spawn_process, vinson_element, Waypoint(csg_end_pos))
champlain_plot = _P.Element.Plot(vinson_plot, champlain_element, Waypoint(GC(13.59000,117.27000)))
chafee_plot = _P.Element.Plot(champlain_plot, chafee_element, Waypoint(GC(13.55000,117.18000)))
'@
    $missionText = Replace-RequiredText $missionText $oldFormation $newFormation "mixed CSG formation replacement"

    $oldSchirraTriggers = @'
schirra_hit_trigger = _T.OnHit(0.0)
schirra_death_trigger = _T.Manual()
schirra_nop_trigger = _T.NonOperational()
schirra_element.NotifyOnShockSuffered(schirra_hit_trigger)
schirra_element.NotifyUponDeath(schirra_death_trigger)
schirra_element.NotifyNonOperational(schirra_nop_trigger)
schirra_destroyed = _T.Or([schirra_hit_trigger, schirra_death_trigger, schirra_nop_trigger])
schirra_hit = _P.Objective.Status(schirra_destroyed, objectives[2], ObjectiveStatus.Completed)

'@
    $missionText = Replace-RequiredText $missionText $oldSchirraTriggers "" "stale supply-ship triggers removal"

    $missionBytes = $utf8.GetBytes($missionText)
    $missionHash = Get-Md5 $missionBytes

    $manifestText = $utf8.GetString((Read-ZipEntryBytes $manifestEntry))
    $manifest = $manifestText | ConvertFrom-Json
    $missionRecord = @($manifest.content | Where-Object { $_.path -eq $missionPath })
    if ($missionRecord.Count -ne 1) {
        throw "Expected exactly one manifest record for $missionPath; found $($missionRecord.Count)."
    }
    $missionRecord[0].hash = $missionHash
    $manifestBytes = $utf8.GetBytes(($manifest | ConvertTo-Json -Depth 8) + "`n")

    $temporaryOutput = "$resolvedOutput.partial"
    if (Test-Path -LiteralPath $temporaryOutput) {
        Remove-Item -LiteralPath $temporaryOutput -Force
    }

    $outputStream = [System.IO.File]::Open($temporaryOutput, [System.IO.FileMode]::CreateNew)
    $outputZip = New-Object System.IO.Compression.ZipArchive($outputStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
    try {
        foreach ($entry in $inputZip.Entries) {
            $newEntry = $outputZip.CreateEntry($entry.FullName, [System.IO.Compression.CompressionLevel]::Optimal)
            if ([string]::IsNullOrEmpty($entry.Name)) {
                continue
            }

            $newStream = $newEntry.Open()
            try {
                if ($entry.FullName -eq $missionPath) {
                    $newStream.Write($missionBytes, 0, $missionBytes.Length)
                }
                elseif ($entry.FullName -eq $manifestPath) {
                    $newStream.Write($manifestBytes, 0, $manifestBytes.Length)
                }
                else {
                    $oldStream = $entry.Open()
                    try {
                        $oldStream.CopyTo($newStream)
                    }
                    finally {
                        $oldStream.Dispose()
                    }
                }
            }
            finally {
                $newStream.Dispose()
            }
        }
    }
    finally {
        $outputZip.Dispose()
        $outputStream.Dispose()
    }

    Move-Item -LiteralPath $temporaryOutput -Destination $resolvedOutput -Force
}
finally {
    $inputZip.Dispose()
    $inputStream.Dispose()
}

$result = Get-FileHash -LiteralPath $resolvedOutput -Algorithm MD5
[PSCustomObject]@{
    package = $resolvedOutput
    package_md5 = $result.Hash.ToLowerInvariant()
    repaired_mission = $missionPath
    repaired_mission_md5 = $missionHash
}
