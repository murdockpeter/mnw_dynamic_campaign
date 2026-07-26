# Rainbow Panda: AUKUS II repair

This repair targets the stock `rainbow_panda/m2_aukus.mis` mission in the
official `campaigns.kyt` package.

## Cause

The mission requests ship database ID `452` as `USNS Wally Schirra`. In the
current MNW core database, ship ID `452` is `San Antonio`; the Wally Schirra
entry used when the mission was authored is no longer available.

The mission also places a carrier, cruiser, supply ship, destroyer, and
helicopter together in one `ASWFormation`. Mixed formations have caused
mission-model construction and snapshot failures in live testing elsewhere in
this repository.

## Repair

The repair:

- removes the stale Wally Schirra spawn and its secondary objective;
- keeps two surface-combatant objectives playable;
- replaces the mixed CSG squadron with individual routes for the remaining
  cruiser and destroyer;
- leaves the separately assigned Seahawk ASW patrol intact;
- removes the Nimitz/Carl Vinson DBID `246` object after current-build logging
  showed its integrity asset failing during spawn;
- removes the MUOS object and radio processes from AUKUS II after the same log
  showed a recoverable integrity-buffer error during its spawn;
- promotes USS Chafee (Arleigh Burke DBID `294`) to the primary exercise target
  while retaining USS Lake Champlain as the secondary target;
- updates the mission checksum in the package manifest.

No localization keys are added or changed.

## Build a repaired package

Fully exit MNW, then run:

```powershell
.\tools\repair-rainbow-panda-aukus2.ps1
```

The stock package is read but never overwritten. The repaired output is:

```text
dist\campaigns.kyt
```

Keep a backup of the stock `campaigns.kyt`, then replace it with the repaired
file for testing. Steam verification or a game patch may restore the official
package, so the repair may need to be rebuilt afterward. Do not install both
files side by side under different names; the repaired archive is a replacement
for the stock campaign package, not an additional campaign.

### Critical installation rule

The live directory must contain exactly one `.kyt` campaign archive:

```text
Modern Naval Warfare\Var\Scenarios\Packages\Campaigns\campaigns.kyt
```

Move the original package to a backup directory outside
`Var\Scenarios\Packages\Campaigns`. Do not leave files such as
`campaigns_backup.kyt`, `campaigns_original.kyt`, or the downloaded ZIP in the
live campaign directory.

MNW indexes every `.kyt` package in that directory. If both the repaired and
original packages are present, their identical campaign and mission identities
collide. Observed symptoms include:

- `An item with the same key has already been added` in `Player.log`;
- one of the stock campaigns disappearing from the menu;
- MNW loading the original broken AUKUS II instead of the repaired mission;
- inconsistent results between restarts or different players.

Before launching, verify in PowerShell:

```powershell
Get-ChildItem "C:\Program Files (x86)\Steam\steamapps\common\Modern Naval Warfare\Var\Scenarios\Packages\Campaigns" -Filter *.kyt
```

The command must return only `campaigns.kyt`. Players using another Steam
library should substitute their actual MNW installation path.

## Validation

The repair tool is guarded: it stops if the expected stock blocks or manifest
record are absent. After building, verify that the package:

- opens as a ZIP archive;
- contains exactly one `rainbow_panda/m2_aukus.mis`;
- has a manifest checksum matching the repaired mission;
- contains no active `USNS Wally Schirra`, `schirra_element`, or mixed CSG
  `Squadron` references in AUKUS II.

## Confirmed live result

The final compatible-force build was tested successfully in MNW `0.118.8` on
July 25, 2026. AUKUS II loaded after the Carl Vinson/Nimitz and MUOS objects
were removed. The earlier AUKUS II-first package was used only to reach the
mission immediately during diagnosis.

The distribution build restores the official campaign order:

1. AUKUS I
2. repaired AUKUS II
3. El Presidente and the remainder of the normal campaign chain

The repaired AUKUS II mission remains embedded at
`rainbow_panda/m2_aukus.mis` inside `campaigns.kyt`.

## Build an AUKUS II-first test package

To make repaired AUKUS II the first Rainbow Panda mission for load testing:

```powershell
.\tools\repair-rainbow-panda-aukus2.ps1 `
    -Aukus2First `
    -OutputPackage .\dist\campaigns.kyt
```

This test order is:

1. AUKUS II
2. AUKUS I
3. El Presidente and the remainder of the normal campaign chain

Use a fresh player profile or clear existing Rainbow Panda campaign progress
before testing. Existing campaign saves may retain the previously unlocked
mission graph.

Omit `-Aukus2First` to build the normal distribution order. The builder
restores AUKUS I followed by repaired AUKUS II even when its input is the
temporary test-first package.

## Troubleshooting a tester installation

If AUKUS II still hangs or another campaign disappears:

1. Fully exit MNW.
2. Remove every `.kyt` except the repaired `campaigns.kyt` from the live
   `Packages\Campaigns` directory.
3. Move all backups and downloaded ZIP files outside the MNW installation.
4. Fully restart MNW and test again.
5. If the problem persists, collect:

   ```text
   %USERPROFILE%\AppData\LocalLow\WaveOps\ModernNavalWarfare\Player.log
   ```

The distributed package was built and tested against MNW `0.118.8`. A tester
on a different game build should restore the package shipped with that build
and use the repair builder against their local package rather than installing
the prebuilt `campaigns.kyt`.
