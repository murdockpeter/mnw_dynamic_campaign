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
- keeps the carrier and cruiser objectives playable;
- replaces the mixed CSG squadron with individual routes for the carrier,
  cruiser, and destroyer;
- leaves the separately assigned Seahawk ASW patrol intact;
- updates the mission checksum in the package manifest.

No localization keys are added or changed.

## Build a repaired package

Fully exit MNW, then run:

```powershell
.\tools\repair-rainbow-panda-aukus2.ps1
```

The stock package is read but never overwritten. The repaired output is:

```text
dist\campaigns-rainbow-panda-aukus2-fixed.kyt
```

Keep a backup of the stock `campaigns.kyt`, then replace it with the repaired
file for testing. Steam verification or a game patch may restore the official
package, so the repair may need to be rebuilt afterward. Do not install both
files side by side under different names; the repaired archive is a replacement
for the stock campaign package, not an additional campaign.

## Validation

The repair tool is guarded: it stops if the expected stock blocks or manifest
record are absent. After building, verify that the package:

- opens as a ZIP archive;
- contains exactly one `rainbow_panda/m2_aukus.mis`;
- has a manifest checksum matching the repaired mission;
- contains no active `USNS Wally Schirra`, `schirra_element`, or mixed CSG
  `Squadron` references in AUKUS II.

The final validation still requires launching AUKUS II in a fresh MNW session.
