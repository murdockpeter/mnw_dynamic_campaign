# Silent Meridian

`Silent Meridian` is a custom two-mission campaign package for `Modern Naval Warfare`.

This repo is organized as an authoring workspace, not just a dropped game archive. The editable campaign source lives under `src/package`, while `tools/` contains scripts to rebuild and deploy the `.kyt` package.

## Layout

```text
RESEARCH.md
README.md
src/
  package/
    locale.csv
    manifest.json
    template.cmp.json
    template.mis.json
    norwegian_shadow/
      quest.cmp
      quest.cmp.json
      bear_gap.mis
      bear_gap.mis.json
      broken_datum.mis
      broken_datum.mis.json
tools/
  build.ps1
  deploy.ps1
dist/
```

## Notes

- The visible in-game campaign title is `Silent Meridian`.
- The internal package folder and mission keys still use `norwegian_shadow` for compatibility with the working campaign package.
- Mission completion currently uses a scripted `raise antennas` trigger instead of relying on `Quit Mission`.
- `.kyt` packages are ZIP archives, but MNW is sensitive to path formatting. The included build script writes forward-slash entries and explicit directory entries to match shipped packages.

## Build

From the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\build.ps1
```

That writes:

```text
dist/norwegian_shadow.kyt
```

## Deploy

Default deployment targets:

- `C:\Program Files (x86)\Steam\steamapps\common\Modern Naval Warfare\Var\Scenarios\Packages\Campaigns`
- `C:\Users\<YourUser>\AppData\LocalLow\WaveOps\ModernNavalWarfare\Scenarios\Packages\Campaigns`

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\deploy.ps1
```

If your install paths differ, pass them explicitly:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\deploy.ps1 -GameCampaignPath "C:\Path\To\Campaigns" -UserCampaignPath "C:\Path\To\User\Campaigns"
```

## What To Commit

Commit:

- `src/package/`
- `tools/`
- `README.md`
- `RESEARCH.md`
- `.gitignore`

Do not commit:

- extracted reference packages in `tmp/`
- generated archives in `dist/`
- any local game logs or install-tree files
