# Modern Naval Warfare Dynamic Campaign Generator

This repository is meant to be a reusable authoring kit for `Modern Naval Warfare`, not just a home for one fixed campaign.

Latest General How-To Is Located Here: https://murdockpeter.github.io/mnw_dynamic_campaign/local-ai-campaign-workflow.html

It contains:

- a working custom campaign package
- verified package/build rules for MNW `.kyt` content
- editable mission and campaign source files
- a local-only database inventory script for MNW platform archives
- a modular external persistence scaffold
- a UI scaffold that mirrors backend persistence structures from the start
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

## Quickstart Guide

If you want a more detailed, visual, local-first walkthrough for using this repo with ChatGPT/Codex, Claude, or GitHub Copilot CLI, start here:

- `docs/local-ai-campaign-workflow.html`

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
4. Tell it to use `src/package/` as the source of truth for MNW package content.
5. If it needs platform context, have it run `tools/index-db.ps1` against the user's local MNW install.
6. If it needs campaign persistence logic, have it work against `engine/`, `modules/`, `storage/`, and `campaigns/`.
7. If it needs user-facing workflow changes, have it inspect `ui/`.
8. Have it run `tools/build.ps1`.
9. Optionally have it run `tools/deploy.ps1`.
10. Test in game.
11. Iterate based on in-game behavior and `Player.log`.

### What To Tell The AI Explicitly

Tell it:

- do not invent new binary formats
- preserve MNW `.kyt` packaging rules
- preserve forward-slash ZIP entry names
- treat `src/package/` as the editable MNW source tree
- update `manifest.json` hashes whenever package files change
- use `generated/db/` only as a local index derived from the user's own game install
- keep persistence systems modular and selectable by configuration
- keep UI and backend data contracts aligned

## Build

From the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\build.ps1
```

This rebuilds the package from `src/package/` and writes:

```text
dist/norwegian_shadow.kyt
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
python .\parsers\mnw_debrief_parser.py --input .\parsers\sample_debrief_bear_gap.txt
```

Important constraint:

- this parser is a draft assistant, not a trusted final importer
- you should still validate the generated JSON before ingesting it
- direct debrief-to-state automation can come later once more MNW report formats are captured

## Files Worth Committing

Commit:

- `src/package/`
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
