# Modern Naval Warfare Dynamic Campaign Generator

This repository is a reusable authoring and runtime toolkit for `Modern Naval Warfare` dynamic campaigns.

It contains:

- sample MNW campaign packages
- package build and deploy tooling
- a modular persistence scaffold
- a browser and Electron frontend
- a deterministic campaign generator that does not require external AI
- a continuation workflow that rewrites a reserved follow-on mission slot after mission results are saved and reviewed
- optional AISStream sampling that can seed merchant traffic from live AIS contact snapshots
- developer and player workflows side by side

## Start Here

Choose the guide that matches what you are trying to do.

### Players

Use the packaged desktop app if you are not planning to edit code or build from source.

Start with:

- [DESKTOP_APP_GUIDE.md](./DESKTOP_APP_GUIDE.md)

Typical player artifacts:

- `dist\MNW Dynamic Campaign Console Setup 0.1.1.exe`
- `dist\MNW Dynamic Campaign Console Setup 0.1.1.exe.blockmap`
- `dist\latest.yml`
- `dist\*.dmg` when a macOS build is produced

### Developers

Use the developer workflow if you want to:

- edit campaigns or missions
- run the original PowerShell or Python tools
- extend the persistence runtime
- work on the UI or Electron wrapper
- generate and distribute new campaign packages

Start with:

- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)

## Repo Purpose

The repo supports two audiences on purpose:

- players who need a packaged desktop app
- developers or operators who need direct access to source, scripts, and packaging internals

The packaged app does not replace the original repo-native workflow. It sits alongside it.

For the packaged desktop workflow, the intended post-mission loop is now:

1. export the current runtime snapshot from the live campaign
2. save the mission result directly inside `Campaign Tracking`
3. continue the campaign if you want to rewrite the reserved next scenario

Practical current model:

- the generator can start a campaign with a playable first scenario plus a reserved follow-on slot
- `Continue Campaign` rewrites that reserved slot from the latest saved result
- the app also keeps one additional reserved slot behind it so MNW always has a valid next mission node
- if the player does not want to continue, the previous completed mission can be treated as the campaign conclusion

## Main Components

- `src/`
  MNW campaign and mission source trees
- `tools/`
  original PowerShell and Python operator tooling
- `engine/`, `modules/`, `storage/`, `campaigns/`
  modular persistence runtime
- `ui/`
  web frontend used by both browser preview and Electron app
- `electron/`
  desktop wrapper
- `portable/`
  Node-based portable build, deploy, export, ingest, generation, continuation, and AIS actions
- `shared/campaign-generator.mjs`
  deterministic campaign blueprint, placeholder-slot, and continuation generator

## Release Recommendation

For non-technical users, distribute packaged installers rather than asking them to run `npm`, Python, or PowerShell.

For technical users, keep using the source repo and the developer guide.

## Supporting Docs

- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)
- [DESKTOP_APP_GUIDE.md](./DESKTOP_APP_GUIDE.md)
- [RESEARCH.md](./RESEARCH.md)
- [ui/README.md](./ui/README.md)
- `docs/local-ai-campaign-workflow.html`
- `docs/tool-reference.html`
