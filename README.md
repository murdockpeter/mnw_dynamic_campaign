# Modern Naval Warfare Dynamic Campaign Generator

This repository is meant to be a reusable authoring kit for `Modern Naval Warfare`, not just a home for one fixed campaign.

Latest General How-To Is Located Here: https://murdockpeter.github.io/mnw_dynamic_campaign/local-ai-campaign-workflow.html
Latest Tool Reference Is Located Here: https://murdockpeter.github.io/mnw_dynamic_campaign/tool-reference.html

## For Players

If you are not planning to edit code, run scripts, or build the desktop app yourself, use the packaged desktop release instead of the repo-native workflow.

Use:

- `dist\MNW Dynamic Campaign Console Setup 0.1.0.exe` on Windows
- the packaged `.dmg` on macOS once one is built and released

Player flow:

1. install the packaged desktop app
2. launch it
3. complete the `Setup` screen once with your MNW paths
4. use `Authoring` to generate, build, and deploy a campaign package
5. use `Campaign Tracking` after each mission to review runtime state and ingest results

If you want the end-user version of these instructions, see `DESKTOP_APP_GUIDE.md`.

It contains:

- working custom campaign packages
- verified package/build rules for MNW `.kyt` content
- editable mission and campaign source files
- a local-only database inventory script for MNW platform archives
- a modular external persistence scaffold
- a UI scaffold that mirrors backend persistence structures from the start
- a portable Electron/Desktop path that keeps the UI but removes Python/PowerShell as an end-user requirement
- helper scripts to rebuild and deploy packages
- research notes on the game's scenario structure

The intent is simple: you should be able to point any generative AI coding tool at this repository and use it to create new scenarios, new campaigns, persistent campaign systems, and eventually a full dynamic campaign generator on top of the same file structure.

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
It also now supports separate standalone package trees in one repo, so unrelated campaigns can be built and distributed as separate `.kyt` archives.

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

The Electron UI now adds a deterministic campaign wizard that can preview believable multi-scenario routing without any AI model. In browser-only mode it works as a preview surface. In the desktop app it can also write campaign files, build packages, deploy them, and export or ingest runtime state.

### Desktop UI Workspaces

The packaged app is now split into three separate workspaces:

- `Setup`
- `Authoring`
- `Campaign Tracking`

Practical intent:

- `Setup` is where the user configures install paths and saved defaults
- `Authoring` is where the user generates a campaign, reviews route geometry, builds packages, and deploys them
- `Campaign Tracking` is where the user inspects runtime state and ingests mission results

This separation is deliberate. Setup tasks should not be mixed into runtime tracking, and runtime tracking should not be mixed into package authoring.

### Release Artifacts For Players

If you are distributing this to players who should not need Node, Python, or PowerShell, the important release artifacts are:

- Windows installer: `dist\MNW Dynamic Campaign Console Setup 0.1.0.exe`
- Windows update metadata: `dist\MNW Dynamic Campaign Console Setup 0.1.0.exe.blockmap`
- Windows release metadata: `dist\latest.yml`
- macOS installer: `dist\*.dmg` when built on macOS

Recommended distribution model:

- keep the repo as the development and authoring source
- distribute packaged installers separately for players
- optionally include one prebuilt campaign package if you want an immediate one-click gameplay starting point

### Campaign ID vs Package ID

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

The desktop path now includes a rule-based generator in `shared/campaign-generator.mjs`.

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
4. creates derived geometry such as:
   - player spawn
   - initial datum
   - lead enemy contact
   - escort positions
   - barrier or egress points
   - support stations
   - withdrawal leg
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

### Tone Selection Does

Tone selection changes:

- the ordered mission archetype sequence
- the pacing of the campaign feel
- the names and summaries chosen from the mission library

### Tone Selection Does Not

Tone selection does not change:

- the selected theater
- the player faction
- the enemy faction
- the underlying route family

That separation keeps the generated campaign coherent. The same sides and operating area remain intact while the scenario sequence changes from surveillance, breakout-hunt, or sea-denial framing.

## Quickstart Guide

If you want a more detailed, visual, local-first walkthrough for using this repo with ChatGPT/Codex, Claude, or GitHub Copilot CLI, start here:

- `docs/local-ai-campaign-workflow.html`
- `docs/tool-reference.html`
- `DESKTOP_APP_GUIDE.md` for packaged desktop app use

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
  build.ps1
  deploy.ps1
  index-db.ps1
  report-repo.ps1
ui/
  index.html
  styles.css
  app.js
  data/
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

The repository now includes a modular persistence scaffold.

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

See:

- `engine/`
- `modules/`
- `storage/`
- `campaigns/`
- `tests/test_persistence_smoke.py`
- `TODO.md`

## UI Scaffold

The repository also includes a UI layer under `ui/`.

It is intentionally:

- web-native
- backend-shape aware
- easy for AI tools to modify
- suitable for later Tauri wrapping on Windows and macOS

Current UI purpose:

- inspect campaign state
- inspect enabled persistence modules
- inspect normalized mission-result events
- inspect next-mission generation directives
- build a normalized manual mission-result JSON from the browser
- parse pasted MNW debrief text into a draft normalized result

The UI currently reads sample JSON from `ui/data/sample-runtime.json`.

That is deliberate. It keeps the frontend evolving in lockstep with the persistence backend before we bind it to a real command bridge.

If `generated/ui/runtime.json` exists, the UI now prefers that live exported snapshot instead of the static sample file.

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

This rebuilds the included `Norwegian Shadow` sample package from `src/package/` and writes:

```text
dist/norwegian_shadow.kyt
```

To build a separate standalone package:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\build.ps1 -SourceDir .\src\packages\iron_archipelago -OutputPath .\dist\iron_archipelago.kyt
```

The build script:

- recalculates `manifest.json` hashes
- writes official-style ZIP entries
- preserves forward-slash archive paths

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

`deploy.ps1` now preserves the actual package filename instead of renaming everything to `norwegian_shadow.kyt`.

## Testing

Persistence smoke test:

```powershell
python -m unittest tests.test_persistence_smoke
```

This verifies:

- state creation
- JSON persistence
- result ingestion
- module processing
- time advancement
- next-mission directive generation

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

Example normalized result inputs:

- `parsers/manual_result_example.json`
- `parsers/manual_result_followup.json`

The UI now also includes a manual result builder that can generate a normalized result JSON for later ingestion.

At the moment, this manual or semi-manual JSON flow is the authoritative persistence input path.

That means:

- it does not replace MNW's own in-game debrief screens
- it does replace any need for this repo to depend on an in-game log bridge right now
- campaign persistence is driven by normalized result JSON that you review and ingest locally

## Debrief Text Parser

The repo now includes a first-pass MNW debrief parser.

Its job is intentionally narrow:

- accept pasted debrief text
- infer mission name and outcome
- parse platform status blocks
- produce a draft normalized result JSON
- let the operator review and correct it before ingestion

Current entry points:

- browser UI `Debrief Text Parser` panel
- CLI parser at `parsers/mnw_debrief_parser.py`

Example:

```powershell
python .\parsers\mnw_debrief_parser.py --input .\parsers\sample_debrief_bear_gap.txt --runtime-json .\ui\data\sample-runtime.json
```

If you provide `--runtime-json`, the parser will try to resolve parsed platform names onto persistent unit IDs from the current campaign state or exported UI runtime snapshot.

The parser currently knows how to:

- infer mission outcome
- extract elapsed time from simple hour or `HH:MM:SS` patterns
- parse ownship and vessel status blocks
- classify `Destroyed`, `Non-Op`, `Light Damage`, `Moderate Damage`, and `Heavy Damage`
- map parsed platforms onto known persistent units when runtime state is available

Important constraint:

- this parser is a draft assistant, not a trusted final importer
- you should still validate the generated JSON before ingesting it
- direct debrief-to-state automation can come later once more MNW report formats are captured

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
- `README.md`
- `RESEARCH.md`
- `TODO.md`
- `.gitignore`

Do not commit:

- `tmp/` extracted reference content
- `generated/` local DB summaries and reports
- generated release artifacts unless you want them versioned
- local game logs
- anything from your actual game install directories

## Research

See [RESEARCH.md](./RESEARCH.md).

That file captures the important reverse-engineering work behind this repo:

- install layout
- package paths
- `.kyt` structure
- `.cmp` and `.mis` script behavior
- DB archive observations
- constraints discovered through real load testing

## Practical Advice

Do not separate UI and backend planning by months.

If the UI is intended to drive campaign-state workflows, module selection, result ingestion, and generation review, it should evolve alongside the persistence runtime. That is why this repo now contains both the modular backend scaffold and a matching UI scaffold at the same time.

## Hard-Won MNW Rules

These rules were validated through live in-game testing, failed experiments, `Player.log` review, and repeated rebuild/deploy cycles.

- Treat the selected package source tree as the source of truth for that package's MNW content.
- Use `src/package/` for the included sample package and `src/packages/<campaign-id>/` for standalone distributable campaigns.
- Always rebuild the `.kyt` after any mission or campaign edit. Do not copy loose `.mis` or `.cmp` assumptions into deployment logic.
- Always redeploy after rebuild, then verify the deployed package hash matches the specific `.kyt` you just built.
- Fully exit and relaunch MNW after deployment when validating campaign progression or save behavior.
- Custom campaign mission IDs must use the package namespace actually present in the archive, for example `norwegian_shadow.norwegian_shadow.bear_gap`.
- If a campaign is meant to be its own thing, give it its own package tree, its own `.kyt`, and its own mission namespace.
- Do not swap to official-style IDs like `campaigns.norwegian_shadow.*` unless the package truly uses that namespace. That specific mistake caused mission lookup failures.
- Reintroduce new campaign graph links one step at a time. First prove Mission 1 -> Mission 2 works, then add Mission 3.
- If a campaign disappears from the menu or hangs on `Loading Missions...`, first suspect a bad mission reference or a manifest/package mismatch before suspecting the game install.
- If post-mission debrief hangs on `Saving...`, inspect `Player.log` for snapshot/model exceptions before changing campaign progression logic.
- In `Broken Datum`, a save hang was caused by `ASWFormation.ConstructModel()` during snapshot save. Replacing the problematic mixed formation with individual element plots fixed it.
- Avoid introducing complex mixed formations casually, especially when save/snapshot behavior has not been validated.
- When debugging MNW content, restore the last known-good campaign graph first, then add only one new variable at a time.

For the full technical record, including the exact failure modes and the fixes that worked, see `RESEARCH.md`.
