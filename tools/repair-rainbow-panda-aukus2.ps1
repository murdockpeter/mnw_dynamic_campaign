param(
    [string]$InputPackage = "C:\Program Files (x86)\Steam\steamapps\common\Modern Naval Warfare\Var\Scenarios\Packages\Campaigns\campaigns.kyt",
    [string]$OutputPackage = (Join-Path $PSScriptRoot "..\dist\campaigns.kyt"),
    [switch]$Aukus2First
)

$ErrorActionPreference = "Stop"

$missionPath = "rainbow_panda/m2_aukus.mis"
$campaignPath = "rainbow_panda/quest.cmp"
$manifestPath = "manifest.json"
$resolvedInput = (Resolve-Path -LiteralPath $InputPackage).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPackage)
$outputDirectory = Split-Path -Parent $resolvedOutput
$inputDirectory = Split-Path -Parent $resolvedInput
$siblingKytPackages = @(Get-ChildItem -LiteralPath $inputDirectory -Filter "*.kyt" -File)

if ($resolvedInput -eq $resolvedOutput) {
    throw "InputPackage and OutputPackage must be different. This repair never overwrites the stock package."
}

if ($siblingKytPackages.Count -gt 1) {
    Write-Warning "The input directory contains $($siblingKytPackages.Count) .kyt packages. MNW can index every one and create duplicate campaign identities. Keep exactly one campaigns.kyt in the live Packages\Campaigns directory."
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
    $campaignEntry = $inputZip.GetEntry($campaignPath)
    $manifestEntry = $inputZip.GetEntry($manifestPath)
    if ($null -eq $missionEntry) {
        throw "The input package does not contain $missionPath."
    }
    if ($null -eq $manifestEntry) {
        throw "The input package does not contain $manifestPath."
    }
    if ($null -eq $campaignEntry) {
        throw "The input package does not contain $campaignPath."
    }

    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $missionText = $utf8.GetString((Read-ZipEntryBytes $missionEntry))
    $missionText = $missionText.Replace("`r`n", "`n")
    $missionAlreadyRepaired = (
        $missionText.Contains("champlain_plot = _P.Element.Plot") -and
        $missionText.Contains("chafee_plot = _P.Element.Plot") -and
        -not $missionText.Contains("schirra_element") -and
        -not $missionText.Contains('csg_squad = Squadron')
    )

    if (-not $missionAlreadyRepaired) {
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
    }

    $carrierAlreadyRemoved = (
        -not $missionText.Contains("vinson_props") -and
        -not $missionText.Contains("vinson_element") -and
        -not $missionText.Contains("sat_props") -and
        $missionText.Contains("chafee_hit_trigger")
    )

    if (-not $carrierAlreadyRemoved) {
        $oldVinsonId = @'
#Carl Vinson DB ID
vinson_id = 246
'@
        $missionText = Replace-RequiredText $missionText $oldVinsonId "" "failing Carl Vinson database declaration removal"

        $oldSatellite = @'
##
# Transmissions
##
sat_spawn_zone = _Z.Circular("Sat Spawn Zone", player_spawn_pos, 10000)
sat_props = Element.Props.FromDatabaseID(us_fact, "MUOS", ElementCategory.SpaceElement, 1, sat_spawn_zone.RandomPosition())
sat_element = Element(sat_props).SetElevation(500)
sat_spawn_process = _P.Element.Spawn(player_spawn_process, sat_element, sat_element.Position)

transmission = Transmission.Create(EMFTools.Protocol.Link_16, _date_time, 60, 10, 500, EMFTools.MicroWaveBands.UHF)
transmission_process = _P.Element.Radio(sat_spawn_process, sat_element, transmission)

'@
        $missionText = Replace-RequiredText $missionText $oldSatellite "" "MUOS satellite and opening transmission removal"

        $oldVinsonSpawn = @'
vinson_props = Element.Props.FromDatabaseID(us_fact, "USS Carl Vinson", ElementCategory.Ship, vinson_id, csg_spawn_pos)
vinson_element = Element(vinson_props).SetHVU(True)
vinson_spawn_process = _P.Element.Spawn(player_spawn_process, vinson_element, csg_spawn_pos)

'@
        $missionText = Replace-RequiredText $missionText $oldVinsonSpawn "" "failing Carl Vinson spawn removal"

        $oldMovement = @'
# Keep unlike surface and air elements out of a single ASWFormation. Mixed
# formations are fragile during mission construction and snapshot creation.
vinson_plot = _P.Element.Plot(taylor_spawn_process, vinson_element, Waypoint(csg_end_pos))
champlain_plot = _P.Element.Plot(vinson_plot, champlain_element, Waypoint(GC(13.59000,117.27000)))
chafee_plot = _P.Element.Plot(champlain_plot, chafee_element, Waypoint(GC(13.55000,117.18000)))
'@
        $newMovement = @'
# Keep unlike surface and air elements out of a single ASWFormation. Mixed
# formations are fragile during mission construction and snapshot creation.
champlain_plot = _P.Element.Plot(taylor_spawn_process, champlain_element, Waypoint(GC(13.59000,117.27000)))
chafee_plot = _P.Element.Plot(champlain_plot, chafee_element, Waypoint(GC(13.55000,117.18000)))
'@
        $missionText = Replace-RequiredText $missionText $oldMovement $newMovement "carrier-free CSG movement"

        $oldVinsonTriggers = @'
vinson_hit_trigger = _T.OnHit(0.0)
vinson_death_trigger = _T.Manual()
vinson_nop_trigger = _T.NonOperational()
vinson_element.NotifyOnShockSuffered(vinson_hit_trigger)
vinson_element.NotifyUponDeath(vinson_death_trigger)
vinson_element.NotifyNonOperational(vinson_nop_trigger)
vinson_destroyed = _T.Or([vinson_hit_trigger, vinson_death_trigger, vinson_nop_trigger])
vinson_hit = _P.Objective.Status(vinson_destroyed, objectives[0], ObjectiveStatus.Completed)
'@
        $newChafeeTriggers = @'
chafee_hit_trigger = _T.OnHit(0.0)
chafee_death_trigger = _T.Manual()
chafee_nop_trigger = _T.NonOperational()
chafee_element.NotifyOnShockSuffered(chafee_hit_trigger)
chafee_element.NotifyUponDeath(chafee_death_trigger)
chafee_element.NotifyNonOperational(chafee_nop_trigger)
chafee_destroyed = _T.Or([chafee_hit_trigger, chafee_death_trigger, chafee_nop_trigger])
chafee_hit = _P.Objective.Status(chafee_destroyed, objectives[0], ObjectiveStatus.Completed)
'@
        $missionText = Replace-RequiredText $missionText $oldVinsonTriggers $newChafeeTriggers "primary objective retargeting to USS Chafee"

        $oldEndTransmission = @'
end_transmission = Transmission.Create(EMFTools.Protocol.Link_16, _date_time, 60, 10, 500, EMFTools.MicroWaveBands.UHF)
end_transmission_process = _P.Element.Radio(end_message_proccess, sat_element, end_transmission)
'@
        $missionText = Replace-RequiredText $missionText $oldEndTransmission "" "MUOS mission-end transmission removal"
    }

    $missionBytes = $utf8.GetBytes($missionText)
    $missionHash = Get-Md5 $missionBytes

    $campaignText = $utf8.GetString((Read-ZipEntryBytes $campaignEntry))
    $campaignText = $campaignText.Replace("`r`n", "`n")
    $campaignWasAlreadyReordered = $false
    $campaignWasAlreadyNormal = $false

    if ($Aukus2First) {
        $campaignWasAlreadyReordered = (
            $campaignText.Contains('_start = Mis("campaigns.rainbow_panda.m2_aukus")') -and
            $campaignText.Contains('_start.PipeMission("campaigns.rainbow_panda.m1_aukus").PipeMission("campaigns.rainbow_panda.m3_el_presidente")')
        )
        if (-not $campaignWasAlreadyReordered) {
            $campaignText = Replace-RequiredText `
                $campaignText `
                '_start = Mis("campaigns.rainbow_panda.m1_aukus")' `
                '_start = Mis("campaigns.rainbow_panda.m2_aukus")' `
                "AUKUS II test-first starting mission"
            $campaignText = Replace-RequiredText `
                $campaignText `
                '_start.PipeMission("campaigns.rainbow_panda.m2_aukus").PipeMission("campaigns.rainbow_panda.m3_el_presidente")' `
                '_start.PipeMission("campaigns.rainbow_panda.m1_aukus").PipeMission("campaigns.rainbow_panda.m3_el_presidente")' `
                "AUKUS II test-first follow-on order"
        }
    }
    else {
        $campaignWasAlreadyNormal = (
            $campaignText.Contains('_start = Mis("campaigns.rainbow_panda.m1_aukus")') -and
            $campaignText.Contains('_start.PipeMission("campaigns.rainbow_panda.m2_aukus").PipeMission("campaigns.rainbow_panda.m3_el_presidente")')
        )
        if (-not $campaignWasAlreadyNormal) {
            $campaignText = Replace-RequiredText `
                $campaignText `
                '_start = Mis("campaigns.rainbow_panda.m2_aukus")' `
                '_start = Mis("campaigns.rainbow_panda.m1_aukus")' `
                "normal AUKUS I starting mission"
            $campaignText = Replace-RequiredText `
                $campaignText `
                '_start.PipeMission("campaigns.rainbow_panda.m1_aukus").PipeMission("campaigns.rainbow_panda.m3_el_presidente")' `
                '_start.PipeMission("campaigns.rainbow_panda.m2_aukus").PipeMission("campaigns.rainbow_panda.m3_el_presidente")' `
                "normal AUKUS II follow-on order"
        }
    }

    $campaignBytes = $utf8.GetBytes($campaignText)
    $campaignHash = Get-Md5 $campaignBytes

    $manifestText = $utf8.GetString((Read-ZipEntryBytes $manifestEntry))
    $manifest = $manifestText | ConvertFrom-Json
    $missionRecord = @($manifest.content | Where-Object { $_.path -eq $missionPath })
    if ($missionRecord.Count -ne 1) {
        throw "Expected exactly one manifest record for $missionPath; found $($missionRecord.Count)."
    }
    $missionRecord[0].hash = $missionHash

    $campaignRecord = @($manifest.content | Where-Object { $_.path -eq $campaignPath })
    if ($campaignRecord.Count -ne 1) {
        throw "Expected exactly one manifest record for $campaignPath; found $($campaignRecord.Count)."
    }
    $campaignRecord[0].hash = $campaignHash

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
                elseif ($entry.FullName -eq $campaignPath) {
                    $newStream.Write($campaignBytes, 0, $campaignBytes.Length)
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
    mission_was_already_repaired = $missionAlreadyRepaired
    carrier_was_already_removed = $carrierAlreadyRemoved
    aukus2_first = [bool]$Aukus2First
    campaign_was_already_reordered = $campaignWasAlreadyReordered
    campaign_was_already_normal = $campaignWasAlreadyNormal
    campaign_md5 = $campaignHash
    source_directory_kyt_count = $siblingKytPackages.Count
}
