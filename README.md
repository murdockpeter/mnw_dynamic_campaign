# Modern Naval Warfare Dynamic Campaign Generator

This repository is meant to be a reusable authoring kit for `Modern Naval Warfare`, not just a home for one fixed campaign.

It contains:

- a working custom campaign package
- verified package/build rules for MNW `.kyt` content
- editable mission and campaign source files
- helper scripts to rebuild and deploy packages
- research notes on the game’s scenario structure

The intent is simple: you should be able to point any generative AI coding tool at this repository and use it to create new scenarios, new campaigns, or eventually a full dynamic campaign generator on top of the same file structure.

## What This Repo Is

This repo is a starter framework for:

- authoring custom `.mis` mission files
- authoring custom `.cmp` campaign chains
- packaging MNW content into valid `.kyt` archives
- testing custom content in a real game install
- evolving from hand-authored scenarios into AI-assisted generation

It already includes one working sample campaign package so there is a known-good baseline to copy, rename, and extend.

## What This Repo Is Not

This is not yet a full persistence-driven dynamic campaign engine.

Right now it provides:

- package structure
- sample authored content
- build and deploy tooling
- format knowledge

The next layer, if you want it, is adding local campaign-state files and a generator that writes future missions from previous mission outcomes.

## Repo Layout

```text
RESEARCH.md
README.md
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
tools/
  build.ps1
  deploy.ps1
dist/
```

## Core Concepts

MNW content authoring in this repo is built around a few practical facts:

- `.kyt` files are ZIP archives
- campaign structure is driven by plain-text `.cmp` scripts
- scenario logic is driven by plain-text `.mis` scripts
- `.mis.json` and `.cmp.json` sidecars hold visible metadata/localization
- `locale.csv` also contains visible strings
- archive entry paths matter; MNW expects forward-slash ZIP paths

The current build script already handles the packaging details that are easy to get wrong.

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
4. Tell it to use `src/package/` as the source of truth.
5. Have it modify or duplicate the sample campaign under `src/package/norwegian_shadow/`.
6. Have it run `tools/build.ps1`.
7. Optionally have it run `tools/deploy.ps1`.
8. Test in game.
9. Iterate based on in-game behavior and `Player.log`.

### Good Prompts To Give An AI

- `Create a new three-mission US submarine campaign using the existing package structure in src/package.`
- `Duplicate the sample campaign, rename its internal package key, and replace the missions with a North Atlantic convoy storyline.`
- `Use the existing mission scripts as templates and generate a new single mission focused on ASW prosecution near island terrain.`
- `Add a local campaign_state.json design and scaffold a generator that can produce the next mission from previous outcomes.`
- `Inspect RESEARCH.md and explain how MNW campaign chaining works, then implement a branching campaign example.`

### What To Tell The AI Explicitly

Tell it:

- do not invent new binary formats
- preserve MNW `.kyt` packaging rules
- preserve forward-slash ZIP entry names
- treat `src/package/` as the editable source tree
- update `manifest.json` hashes whenever package files change
- use the existing campaign as a pattern, not a hard constraint

That last point matters. The included `norwegian_shadow` package is a working reference implementation, not the final desired architecture.

## The Sample Package

The included sample package currently contains:

- one custom campaign chain
- two missions
- working build/deploy flow
- a known-good in-game package layout

Use it as:

- a template for new campaigns
- a test fixture while improving tooling
- a safe baseline when debugging loader/package issues

The internal package folder still uses `norwegian_shadow` because it was the first stable working custom package. That does not limit what you can build next.

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

## Deploy

Default deployment targets:

- `C:\Program Files (x86)\Steam\steamapps\common\Modern Naval Warfare\Var\Scenarios\Packages\Campaigns`
- `C:\Users\<YourUser>\AppData\LocalLow\WaveOps\ModernNavalWarfare\Scenarios\Packages\Campaigns`

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\deploy.ps1
```

If your paths differ:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\deploy.ps1 -GameCampaignPath "C:\Path\To\Campaigns" -UserCampaignPath "C:\Path\To\User\Campaigns"
```

## Testing And Debugging

When new content fails, the usual workflow is:

1. build package
2. deploy package
3. launch MNW
4. test mission/campaign load
5. inspect `Player.log`
6. patch source in `src/package/`
7. rebuild and retry

This repo was assembled through exactly that loop.

## How To Grow This Into A Real Dynamic Generator

The clean architecture is:

- keep campaign state outside the game
- store results locally in JSON or another simple format
- generate the next `.mis` and `.cmp` content from that state
- rebuild the `.kyt`
- redeploy into MNW

That means MNW acts as the mission runtime, while your own local scripts or AI agent act as the campaign engine.

Likely future additions:

- `campaign_state.json`
- `mission_history.json`
- OOB/readiness tracking
- branching mission generation
- post-mission parsers
- scenario templating utilities

## Files Worth Committing

Commit:

- `src/package/`
- `tools/`
- `README.md`
- `RESEARCH.md`
- `.gitignore`

Do not commit:

- `tmp/` extracted reference content
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
- constraints discovered through real load testing

## Practical Advice

Do not start by asking an AI to invent a full dynamic campaign engine from scratch.

Start by asking it to:

- duplicate the sample package
- rename it safely
- change mission text and force composition
- add one new mission
- rebuild and test

Once that workflow is stable, then add persistence and generation logic.
