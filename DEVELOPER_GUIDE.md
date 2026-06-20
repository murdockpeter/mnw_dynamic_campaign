# Developer Guide

This guide is for repo users who want to edit content, run scripts, build packages manually, or extend the desktop and persistence tooling.

## What This Repo Is

This repo is a working framework for:

- authoring custom `.mis` mission files
- authoring custom `.cmp` campaign chains
- packaging MNW content into valid `.kyt` archives
- indexing local MNW database archives without redistributing them
- persisting campaign state outside the game
- generating deterministic campaigns and continuation scenarios
- testing custom content in a real game install

It supports:

- the original script-first repo workflow
- a packaged Electron desktop workflow for non-technical users

## Current Product Shape

The current desktop product is no longer just a package builder. It now has a practical campaign loop:

1. generate a campaign package
2. build and deploy it
3. export a live runtime snapshot after play
4. save the mission result inside `Campaign Tracking`
5. continue the campaign by rewriting the reserved next mission slot

This matters for development because several design decisions now exist to satisfy MNW campaign-chain behavior rather than ideal purity:

- the tracker uses exported runtime data only
- the operational map is embedded inside the app
- the campaign chain keeps a reserved follow-on mission slot
- continuation rewrites that reserved slot instead of appending from an empty chain end
- AIS sampling is stored locally in settings and fed into generation as optional merchant traffic

## Desktop App Path

The original script-first workflow remains intact.

In parallel, the repo also contains a portable desktop-app path aimed at end users who should not need to bring their own AI tooling, Python install, or PowerShell scripts.

Main desktop pieces:

- `package.json`
- `electron/`
- `portable/`
- `shared/campaign-generator.mjs`
- `ui/`

Design intent:

- keep the shared `ui/` as the main frontend
- wrap it in Electron for Windows and macOS
- move build, deploy, export, ingest, generation, continuation, and AIS actions into Node-based portable modules
- preserve the original `tools/*.ps1` and Python utilities for repo-native/operator workflows

That means there are now two supported paths:

- original repo workflow using `tools/*.ps1` and Python scripts
- desktop-app workflow using Electron plus the `portable/*.mjs` modules

### Portable Commands

Portable Node equivalents now exist for the main operator actions:

```powershell
node .\portable\build-package.mjs
node .\portable\deploy-package.mjs
node .\portable\export-ui-state.mjs --campaign-id iron_archipelago
node .\portable\ingest-result.mjs --campaign-id iron_archipelago --result .\parsers\manual_result_example.json
node .\portable\generate-campaign.mjs --campaign-id demo_surface_chain --title "Demo Surface Chain" --theater luzon_strait --tone surveillance --scenario-count 3
```

Desktop shell commands:

```powershell
npm install
npm run desktop:start
npm run desktop:dist
```

## Desktop UI Workspaces

The packaged app is split into three workspaces:

- `Setup`
- `Authoring`
- `Campaign Tracking`

Practical intent:

- `Setup` configures install paths, default IDs, package defaults, and optional AIS settings
- `Authoring` generates a campaign, writes campaign files, builds packages, and deploys them
- `Campaign Tracking` inspects runtime state, saves mission results, shows the embedded operational map, surfaces AIS debug data, and rewrites the reserved next mission

## Campaign ID vs Package ID

These two IDs are related, but they are not the same thing conceptually.

- `Campaign ID` is the runtime and persistence identifier
- `Package ID` is the authored MNW package identifier and namespace

In normal use they should usually match.

Example:

- runtime campaign ID: `norwegian_shadow`
- package ID: `norwegian_shadow`
- mission namespace inside the package: `norwegian_shadow.norwegian_shadow.<mission>`

Only split them if you are intentionally tracking one runtime campaign while building or deploying a different package tree.

## Deterministic Campaign Generation

The desktop path includes a rule-based generator in [shared/campaign-generator.mjs](C:/Users/Peter%20G.%20Robbins/Documents/claudeprojects/mnw_dynamic_campaign/shared/campaign-generator.mjs:1).

This generator is intentionally not AI-backed. The goal is to let an end user generate a believable starter campaign without requiring a model provider, API key, prompt workflow, Python environment, or repo knowledge.

### What The Generator Produces

It produces:

- a sanitized campaign ID
- a campaign title and description
- a theater and conflict family
- a player-side force template
- an enemy-side force template
- a sequence of mission archetypes
- deterministic scenario geometry for each scenario
- authoring constraints such as maximum player-to-primary-target distance
- a stable package namespace
- placeholder follow-on scenarios where required for the runtime workflow

### How Believable Pathing Works Without AI

The generator does not invent routes from raw prose. It uses curated theater templates plus deterministic variation.

Each theater template defines route corridors such as:

- player corridor
- enemy corridor
- support corridor
- helo corridor or air corridor

For each scenario, the generator:

1. picks a mission archetype sequence from the selected tone
2. derives a stable seed from campaign ID, theater, tone, year, scenario count, and player name
3. applies bounded jitter to corridor anchor points
4. creates derived geometry such as player spawn, initial datum, lead enemy contact, escort positions, barrier or egress points, support stations, and withdrawal legs
5. advances scenario start times and contact density
6. runs deconfliction so generated placements do not overlap
7. applies authoring constraints such as max distance to primary target

### Current Authoring Controls

The `Authoring` workspace currently exposes:

- campaign title
- campaign ID
- theater
- tone
- start year
- scenario count
- mission posture
- player unit name
- optional `Max Scenario Radius (km)`

`Max Scenario Radius (km)` is an authoring-time pacing control. When set, the generator scales non-AIS generated scenario geometry inward around the player start so generated placements stay inside the requested radius. The value is persisted into generated `campaign.json` and bootstrap state, and continuation scenarios inherit it.

### How Platform Selection Works Per Side

Player-side and enemy-side platform choices are not random.

They come from the selected theater template in [shared/campaign-generator.mjs](C:/Users/Peter%20G.%20Robbins/Documents/claudeprojects/mnw_dynamic_campaign/shared/campaign-generator.mjs:230).

Current examples:

- `luzon_strait`
  - player: U.S. submarine
  - enemies: PLAN surface combatants
  - geometry family: `surface_shadow`
- `south_china_sea`
  - player: U.S. submarine
  - enemies: Russian submarines
  - geometry family: `sub_hunt`
- `norwegian_sea`
  - player: U.S. submarine
  - enemies: Russian submarines
  - geometry family: `sub_hunt`

Theater selection determines the sides and baseline force composition. Tone selection determines the narrative progression of the mission sequence.

## Placeholder Follow-On Model

The current dynamic-campaign implementation uses a reserved next mission slot because MNW expects a valid next mission node in the campaign chain.

Current behavior:

- initial generation creates a playable mission plus a reserved follow-on slot
- the placeholder mission briefing explicitly tells the player not to launch it before regeneration
- `Continue Campaign` rewrites that reserved mission from the latest saved result
- the app keeps another reserved slot behind it so the chain remains valid

Relevant generator text lives in [shared/campaign-generator.mjs](C:/Users/Peter%20G.%20Robbins/Documents/claudeprojects/mnw_dynamic_campaign/shared/campaign-generator.mjs:1803) and [portable/lib/generated-campaign-files.mjs](C:/Users/Peter%20G.%20Robbins/Documents/claudeprojects/mnw_dynamic_campaign/portable/lib/generated-campaign-files.mjs:663).

## AIS Integration

The desktop path now supports optional AISStream sampling.

Current behavior:

- settings can store an AISStream API key locally
- the desktop backend can open the websocket and sample contacts for the current theater
- the latest sample is stored in local settings
- generation can seed merchant traffic from that saved AIS sample
- the tracker surfaces AIS debug JSON for inspection

Important limitation:

- current AIS support is a traffic-seeding feature first
- it is not yet proven to reproduce MNW's native in-sim AIS responder behavior one-for-one

Relevant files:

- [portable/lib/ais-api.mjs](C:/Users/Peter%20G.%20Robbins/Documents/claudeprojects/mnw_dynamic_campaign/portable/lib/ais-api.mjs:1)
- [portable/lib/desktop-api.mjs](C:/Users/Peter%20G.%20Robbins/Documents/claudeprojects/mnw_dynamic_campaign/portable/lib/desktop-api.mjs:195)
- [shared/campaign-generator.mjs](C:/Users/Peter%20G.%20Robbins/Documents/claudeprojects/mnw_dynamic_campaign/shared/campaign-generator.mjs:1535)
- [portable/lib/generated-campaign-files.mjs](C:/Users/Peter%20G.%20Robbins/Documents/claudeprojects/mnw_dynamic_campaign/portable/lib/generated-campaign-files.mjs:170)

## Repo Layout

```text
RESEARCH.md
README.md
DEVELOPER_GUIDE.md
DESKTOP_APP_GUIDE.md
TODO.md
.gitignore
src/
  package/
  packages/
engine/
modules/
storage/
campaigns/
parsers/
tests/
tools/
ui/
electron/
portable/
shared/
dist/
generated/
```

## Core Concepts

MNW content authoring in this repo is built around a few practical facts:

- `.kyt` files are ZIP archives
- campaign structure is driven by plain-text `.cmp` scripts
- scenario logic is driven by plain-text `.mis` scripts
- `.mis.json` and `.cmp.json` sidecars hold visible metadata and localization
- `locale.csv` also contains visible strings
- archive entry paths matter; MNW expects forward-slash ZIP paths
- mission IDs are tied to the package identity plus internal folder structure
- separate distributable campaigns should generally be separate package trees and separate `.kyt` files
- persistence should live outside MNW, not inside mission scripts

## Persistence Architecture

The repository includes a modular persistence scaffold.

Implemented baseline pieces:

- shared campaign state schema
- JSON storage backend
- normalized mission-result format
- tiny runtime that loads enabled modules
- persistence modules for damage and ammo
- generation hook for next-mission writers
- export flow for UI snapshots

Design rules:

- the runtime must not hardcode one persistent campaign system
- different systems should be selectable by campaign configuration
- modules mutate shared state and emit directives
- mission generation remains a separate concern

## UI Notes

The repository includes a UI layer under `ui/`.

Current UI purpose:

- save desktop settings
- generate deterministic campaigns
- build and deploy packages
- inspect exported runtime state
- save a normalized mission result directly from the app
- parse pasted MNW debrief text into a draft result
- preview and open theater operational maps inside the app
- inspect AIS debug payloads
- rewrite one continuation scenario from `Campaign Tracking`

The packaged desktop app embeds the operational map inside `Campaign Tracking` rather than opening it as an external HTML file.

## Build

From the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\build.ps1
```

This rebuilds the included `Norwegian Shadow` sample package from `src/package/`.

To build a separate standalone package:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\build.ps1 -SourceDir .\src\packages\iron_archipelago -OutputPath .\dist\iron_archipelago.kyt
```

## Deploy

Default deployment targets:

- `C:\Program Files (x86)\Steam\steamapps\common\Modern Naval Warfare\Var\Scenarios\Packages\Campaigns`
- `C:\Users\<YourUser>\AppData\LocalLow\WaveOps\ModernNavalWarfare\Scenarios\Packages\Campaigns`

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\deploy.ps1
```

To deploy a specific standalone package:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\deploy.ps1 -PackagePath .\dist\iron_archipelago.kyt
```

## Local Database Inventory

This repo does not ship MNW database files.

Instead, it includes a local-only inventory helper that scans the user's own installed `Var\DB` archives and emits a machine-friendly index under `generated/db/`.

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\index-db.ps1
```

## Testing

Persistence smoke test:

```powershell
python -m unittest tests.test_persistence_smoke
```

Desktop test loop:

1. generate or rewrite the campaign
2. build the package
3. deploy the package
4. fully exit MNW
5. relaunch MNW
6. validate in-game behavior
7. inspect `Player.log` when something diverges

## Manual Result Ingestion

The first operator-facing persistence workflow is now in place:

1. ingest a normalized mission result JSON
2. update persistent campaign state
3. append the mission result to history
4. refresh the UI snapshot

Example helper:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\ingest-and-refresh.ps1
```

Core scripts:

- `tools/ingest-result.py`
- `tools/refresh-ui-state.ps1`
- `tools/ingest-and-refresh.ps1`

For the desktop app path, the normal post-mission loop is now:

1. export the current runtime snapshot
2. save the mission result directly inside `Campaign Tracking`
3. continue the campaign if desired

## Debrief Text Parser

The repo includes a first-pass MNW debrief parser.

Current entry points:

- browser and desktop UI `Debrief Text Parser` panel
- CLI parser at `parsers/mnw_debrief_parser.py`

Example:

```powershell
python .\parsers\mnw_debrief_parser.py --input .\parsers\sample_debrief_bear_gap.txt --runtime-json .\ui\data\sample-runtime.json
```

## Files Worth Committing

Commit:

- `src/package/`
- `src/packages/`
- `engine/`
- `modules/`
- `storage/`
- `campaigns/`
- `parsers/`
- `tests/`
- `tools/`
- `ui/`
- `electron/`
- `portable/`
- `shared/`
- `README.md`
- `DEVELOPER_GUIDE.md`
- `DESKTOP_APP_GUIDE.md`
- `RESEARCH.md`
- `TODO.md`
- `.gitignore`

Do not commit:

- `tmp/`
- `generated/` local DB summaries and reports
- local game logs
- anything from your actual game install directories

## Research

See [RESEARCH.md](./RESEARCH.md).

## Hard-Won MNW Rules

- Treat the selected package source tree as the source of truth for that package's MNW content.
- Use `src/package/` for the included sample package and `src/packages/<campaign-id>/` for standalone distributable campaigns.
- Always rebuild the `.kyt` after any mission or campaign edit.
- Always redeploy after rebuild, then verify the deployed package matches the specific `.kyt` you just built.
- Fully exit and relaunch MNW after deployment when validating campaign progression or save behavior.
- Custom campaign mission IDs must use the package namespace actually present in the archive.
- If a campaign is meant to be its own thing, give it its own package tree, its own `.kyt`, and its own mission namespace.
- If a campaign chain behaves oddly, suspect placeholder-slot timing, package drift, or stale deployed files before assuming persistence is wrong.
- If a campaign disappears from the menu or hangs on `Loading Missions...`, first suspect a bad mission reference or a manifest/package mismatch.
