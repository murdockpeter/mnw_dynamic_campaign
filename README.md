# Modern Naval Warfare Dynamic Campaign Generator

This repository is a reusable authoring and runtime toolkit for `Modern Naval Warfare` dynamic campaigns.

It contains:

- sample MNW campaign packages
- package build and deploy tooling
- a modular persistence scaffold
- a browser and Electron frontend
- a deterministic campaign generator that does not require external AI
- a continuation workflow that can append one more scenario after mission results are saved and reviewed
- developer and player workflows side by side

## Start Here

Choose the guide that matches what you are trying to do.

### Players

Use the packaged desktop app if you are not planning to edit code or build from source.

Start with:

- [DESKTOP_APP_GUIDE.md](./DESKTOP_APP_GUIDE.md)

Typical player artifacts:

- `dist\MNW Dynamic Campaign Console Setup 0.1.0.exe`
- `dist\MNW Dynamic Campaign Console Setup 0.1.0.exe.blockmap`
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

1. export the current runtime snapshot
2. save the mission result directly inside `Campaign Tracking`
3. continue the campaign if you want to append the next scenario

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
  Node-based portable build, deploy, export, ingest, generation, and continuation actions
- `shared/campaign-generator.mjs`
  deterministic campaign blueprint and continuation generator

## Release Recommendation

For non-technical users, distribute packaged installers rather than asking them to run `npm`, Python, or PowerShell.

For technical users, keep using the source repo and the developer guide.

## Supporting Docs

- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)
- [DESKTOP_APP_GUIDE.md](./DESKTOP_APP_GUIDE.md)
- [RESEARCH.md](./RESEARCH.md)
- `docs/local-ai-campaign-workflow.html`
- `docs/tool-reference.html`
