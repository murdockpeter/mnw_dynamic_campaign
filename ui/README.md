# UI Scaffold

This UI is a web-first frontend scaffold for the modular campaign persistence system.

Why this exists now:

- it keeps the UI evolving alongside the backend
- it is easy for AI coding tools to inspect and modify
- it can later be wrapped in Tauri for a cross-platform desktop app

Current purpose:

- inspect campaign metadata
- inspect enabled persistence modules
- inspect order of battle state
- inspect mission result events
- inspect next-mission generation directives
- build a normalized manual mission-result JSON from the browser
- parse pasted MNW debrief text into a draft result before manual review
- choose continuation intent and append one more scenario in the desktop app workflow

The current UI reads static sample data from `ui/data/sample-runtime.json`.

If `generated/ui/runtime.json` exists, the UI prefers that live exported snapshot instead.

## Current Live Workflow

1. Export or bootstrap campaign state.
2. Run the UI.
3. Ingest a normalized mission result JSON.
4. Refresh the exported UI snapshot.
5. If desired, append one more scenario from `Campaign Tracking`.
6. Reload the page and inspect the updated state.

## Manual Result Builder

The UI now includes a manual result builder.

Current flow:

1. open the UI
2. fill in mission outcome, elapsed hours, unit, ammo expenditure, damage, or destruction
3. generate and download normalized result JSON
4. ingest it with:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\ingest-and-refresh.ps1 -ResultPath "C:\Path\To\manual_result.json"
```

This is intentionally simple for now. It keeps the operator workflow visible before we add a direct backend bridge or packaged desktop shell.

## Debrief Text Parser

The UI now also includes a debrief-text parser panel.

Use it when you have copied text from an MNW after-action/debrief screen and want a faster starting point than filling every field by hand.

Current flow:

1. paste debrief text into the parser panel
2. click `Parse Debrief Text`
3. review the generated draft JSON
4. click `Load Into Builder`
5. correct anything the parser could not infer cleanly
6. download or copy the final normalized result JSON
7. ingest it with `tools/ingest-and-refresh.ps1`

This parser should be treated as an operator assist, not a final authority.

It now attempts to:

- infer elapsed mission time from debrief text
- resolve ownship to the player unit when possible
- map known enemy platform names onto persistent unit IDs
- translate common status phrases into draft damage or destruction events

Helper scripts:

- `tools/run-dev.ps1`
- `tools/ingest-result.py`
- `tools/ingest-and-refresh.ps1`
- `tools/refresh-ui-state.ps1`

## Continuation Flow

The desktop app now treats `Campaign Tracking` as the post-mission decision loop.

After ingesting a result, the operator can choose:

- next objective
- risk posture
- operational tempo

Then `Continue Campaign` will:

1. append one new scenario to the campaign mission chain
2. rebuild the package
3. redeploy it when configured paths are available
4. refresh the exported runtime snapshot used by the tracker
