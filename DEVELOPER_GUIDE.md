# Developer Guide

This guide is for repo users who want to edit content, run scripts, build packages manually, or extend the desktop and persistence tooling.

## What This Repo Is

This repo is a starter framework for:

- authoring custom `.mis` mission files
- authoring custom `.cmp` campaign chains
- packaging MNW content into valid `.kyt` archives
- indexing local MNW database archives without redistributing them
- persisting campaign state outside the game
- testing custom content in a real game install
- evolving from hand-authored scenarios into AI-assisted generation

It already includes one working sample campaign package so there is a known-good baseline to copy, rename, and extend.
It also supports separate standalone package trees in one repo, so unrelated campaigns can be built and distributed as separate `.kyt` archives.

## Desktop App Path

The original script-first workflow remains intact.

In parallel, the repo now also contains a portable desktop-app path aimed at end users who should not need to bring their own AI tooling, Python install, or PowerShell scripts.

New pieces:

- `package.json`
- `electron/`
- `portable/`
- `shared/campaign-generator.mjs`

Design intent:

- keep the existing `ui/` as the main frontend
- wrap it in Electron for Windows and macOS
- move build, deploy, export, ingest, and simple campaign generation into Node-based portable modules
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

The packaged app is split into three separate workspaces:

- `Setup`
- `Authoring`
- `Campaign Tracking`

Practical intent:

- `Setup` is where the user configures install paths and saved defaults
- `Authoring` is where the user generates a campaign, reviews route geometry, builds packages, and deploys them
- `Campaign Tracking` is where the user inspects runtime state and ingests mission results

## Campaign ID vs Package ID

These two IDs are related, but they are not the same thing conceptually.

- `Campaign ID` is the runtime/persistence campaign identifier
- `Package ID` is the authored MNW package identifier and namespace

In normal use, they should usually match.

Example:

- runtime campaign ID: `iron_archipelago`
- package ID: `iron_archipelago`
- mission namespace inside the package: `iron_archipelago.iron_archipelago.<mission>`

You only need them to differ if you are intentionally tracking one runtime campaign while building or deploying a different package tree.

## Deterministic Campaign Generation

The desktop path includes a rule-based generator in `shared/campaign-generator.mjs`.

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
- a stable package namespace

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
3. uses that seed to apply bounded jitter to corridor anchor points
4. creates derived geometry such as player spawn, initial datum, lead enemy contact, escort positions, barrier or egress points, support stations, and withdrawal legs
5. advances scenario start times and contact density from one mission to the next

Because the seed is stable, the same inputs always generate the same campaign. Because the jitter is bounded and theater-specific, the output stays believable instead of becoming arbitrary.

### How Platform Selection Works Per Side

Player-side and enemy-side platform choices are not random.

They come from the selected theater template in `shared/campaign-generator.mjs`.

Each theater currently defines:

- player unit ID
- player name
- player faction
- player platform type
- player DBID
- player starting ammo
- enemy roster entries
- enemy faction
- enemy platform type
- enemy DBIDs

Current examples:

- `luzon_strait`
  - player: U.S. submarine
  - enemies: PLAN surface combatants
  - geometry family: `surface_shadow`
- `south_china_sea`
  - player: U.S. submarine
  - enemies: Russian submarines
  - geometry family: `sub_hunt`

That means theater selection determines the sides and baseline force composition, while tone selection determines the narrative progression of the mission sequence.

## What This Repo Is Not

This is not yet a full polished end-user desktop product.

Right now it provides:

- package structure
- sample authored content
- build and deploy tooling
- local DB inventory tooling
- a modular persistence runtime
- a Tauri-friendly web UI scaffold
- format knowledge

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
  packages/
    iron_archipelago/
      manifest.json
      locale.csv
      template.cmp.json
      template.mis.json
      iron_archipelago/
        quest.cmp
        quest.cmp.json
        bashi_screen.mis
        bashi_screen.mis.json
engine/
modules/
storage/
campaigns/
parsers/
tests/
tools/
ui/
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
- `Var\DB` archives are locally readable and can be indexed without shipping them in the repo
- persistence should live outside MNW, not inside mission scripts

## Persistence Architecture

The repository includes a modular persistence scaffold.

Implemented baseline pieces:

- shared campaign state schema
- JSON storage backend
- normalized mission-result format
- tiny runtime that loads enabled modules
- first persistence modules:
  - `damage`
  - `ammo`
- generation-plan hook for next-mission writers
- smoke test for the full persistence loop

Design rule:

- the runtime must not hardcode one persistent campaign system
- different systems should be selectable by campaign configuration
- modules mutate shared state and emit directives
- mission generation remains a separate concern

## UI Scaffold

The repository includes a UI layer under `ui/`.

Current UI purpose:

- inspect campaign state
- inspect enabled persistence modules
- inspect normalized mission-result events
- inspect next-mission generation directives
- build a normalized manual mission-result JSON from the browser
- parse pasted MNW debrief text into a draft normalized result

If `generated/ui/runtime.json` exists, the UI prefers that live exported snapshot instead of the static sample file.

## Using This Repo With Any AI Tool

You do not need a specific model or IDE. Any AI tool that can read and edit files in a local folder can work with this repository.

Examples:

- ChatGPT with local file access
- Claude with local workspace access
- Codex / OpenAI coding agents
- Cursor
- Windsurf
- Copilot Chat in a local repo
- any agentic shell tool that can edit files and run PowerShell

### Recommended AI Workflow

1. Give the AI this repository as its working folder.
2. Tell it your design goal.
3. Point it at `RESEARCH.md` first so it understands MNW packaging and scenario structure.
4. Tell it to use the relevant package source tree as the source of truth for MNW package content.
5. Use `src/package/` for the included `Norwegian Shadow` sample package.
6. Use `src/packages/<campaign-id>/` for a standalone distributable campaign package.
7. If it needs platform context, have it run `tools/index-db.ps1` against the user's local MNW install.
8. If it needs campaign persistence logic, have it work against `engine/`, `modules/`, `storage/`, and `campaigns/`.
9. If it needs user-facing workflow changes, have it inspect `ui/`.
10. Have it run `tools/build.ps1`, optionally with `-SourceDir` and `-OutputPath`.
11. Optionally have it run `tools/deploy.ps1`, optionally with `-PackagePath`.
12. Test in game.
13. Iterate based on in-game behavior and `Player.log`.

### What To Tell The AI Explicitly

Tell it:

- do not invent new binary formats
- preserve MNW `.kyt` packaging rules
- preserve forward-slash ZIP entry names
- treat the selected package source tree as the editable MNW source tree
- keep standalone campaigns in separate package trees when they are meant to be distributed independently
- do not assume two unrelated campaigns should share one `.kyt`
- update `manifest.json` hashes whenever package files change
- use `generated/db/` only as a local index derived from the user's own game install
- keep persistence systems modular and selectable by configuration
- keep UI and backend data contracts aligned

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

## Local Database Inventory

This repo does not ship MNW database files.

Instead, it includes a local-only inventory helper that scans the user's own installed `Var\DB` archives and emits a machine-friendly index under `generated/db/`.

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\index-db.ps1
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

## Testing

Persistence smoke test:

```powershell
python -m unittest tests.test_persistence_smoke
```

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

## Debrief Text Parser

The repo includes a first-pass MNW debrief parser.

Current entry points:

- browser UI `Debrief Text Parser` panel
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

## Practical Advice

Do not separate UI and backend planning by months.

If the UI is intended to drive campaign-state workflows, module selection, result ingestion, and generation review, it should evolve alongside the persistence runtime.

## Hard-Won MNW Rules

- Treat the selected package source tree as the source of truth for that package's MNW content.
- Use `src/package/` for the included sample package and `src/packages/<campaign-id>/` for standalone distributable campaigns.
- Always rebuild the `.kyt` after any mission or campaign edit.
- Always redeploy after rebuild, then verify the deployed package hash matches the specific `.kyt` you just built.
- Fully exit and relaunch MNW after deployment when validating campaign progression or save behavior.
- Custom campaign mission IDs must use the package namespace actually present in the archive.
- If a campaign is meant to be its own thing, give it its own package tree, its own `.kyt`, and its own mission namespace.
- Reintroduce new campaign graph links one step at a time.
- If a campaign disappears from the menu or hangs on `Loading Missions...`, first suspect a bad mission reference or a manifest/package mismatch.
