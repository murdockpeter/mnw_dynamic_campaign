# UI Scaffold

This UI is the shared frontend for the desktop campaign workflow.

It is no longer just a browser mockup. The same UI now drives the packaged Electron app and the repo preview path.

## Current Purpose

The UI currently supports:

- desktop setup and saved defaults
- deterministic campaign authoring
- package build and deploy actions through the desktop backend
- exported runtime-state inspection
- direct mission-result entry
- debrief-text parsing into a draft result payload
- embedded operational-map viewing inside `Campaign Tracking`
- AISStream debug and contact review
- continuation control that rewrites the reserved next mission slot

If `generated/ui/runtime.json` exists, the UI prefers that live exported snapshot instead of sample data.

`Campaign Tracking` no longer loads sample runtime state as a fallback.

## Current Live Workflow

1. Save desktop settings in `Setup`.
2. Generate a campaign in `Authoring`.
3. Build and deploy it.
4. Play the current mission in MNW.
5. Export runtime in `Campaign Tracking`.
6. Save the mission result.
7. If continuing, rewrite the reserved next mission with `Continue Campaign`.
8. Refresh the tracker and validate the new state.

## Manual Result Builder

The UI includes a manual result builder for the normal post-mission loop.

Current flow:

1. open `Campaign Tracking`
2. fill in mission outcome, elapsed hours, unit, ammo expenditure, damage, or destruction
3. click `Save Result To Campaign`
4. let the tracker refresh the live campaign state automatically

`Download JSON` and `Copy JSON` still exist for external records, but they are no longer required for the normal desktop workflow.

## Debrief Text Parser

The UI includes a debrief-text parser panel.

Use it when you have copied text from an MNW after-action or debrief screen and want a faster starting point than filling every field by hand.

Current flow:

1. paste debrief text into the parser panel
2. click `Parse Debrief Text`
3. review the generated draft JSON
4. click `Load Into Builder`
5. correct anything the parser could not infer cleanly
6. click `Save Result To Campaign`

This parser is an operator assist, not a final authority.

## Operational Map

The desktop app now embeds the operational map inside `Campaign Tracking`.

Current behavior:

- the map opens inside the app instead of launching as an external HTML file
- the embedded view is meant to take over the tracker workspace until closed
- the close action returns the user to the tracker

## AIS Support

The UI includes an optional AIS section in `Setup` and a live AIS panel in `Campaign Tracking`.

Current behavior:

- `Setup` stores whether AISStream is enabled, the query radius, and the local API key
- `Campaign Tracking` can request a fresh AIS sample for the current theater
- the tracker shows AIS status, contact summaries, and debug JSON
- the saved sample can later seed merchant traffic during generation

Current limitation:

- the UI can inspect and seed AIS-derived traffic, but this does not yet guarantee one-for-one MNW native responder behavior in the simulator

## Continuation Flow

The desktop app now treats `Campaign Tracking` as the post-mission decision loop.

After ingesting a result, the operator can choose:

- next objective
- risk posture
- operational tempo

Then `Continue Campaign` will:

1. rewrite the reserved next scenario from the latest saved result
2. preserve one additional reserved follow-on slot behind it
3. rebuild the package
4. redeploy it when configured paths are available
5. refresh the exported runtime snapshot used by the tracker

Do not treat the placeholder next mission as a normal playable mission before this rewrite occurs.
