# Desktop App Guide

This guide is for players or operators who want to use the packaged `MNW Campaign Console` desktop app without building anything from source.

## What This App Is For

The desktop app is a packaged frontend and workflow wrapper for the dynamic campaign tooling in this repo.

It lets you:

- configure where `Modern Naval Warfare` stores campaign packages
- generate a simple multi-scenario campaign without bringing your own AI
- build and deploy the generated campaign package
- inspect campaign runtime state
- ingest mission-result JSON after missions

You do not need:

- Python
- PowerShell
- Node.js
- npm
- AI tooling

## What To Install

On Windows, use:

- `MNW Dynamic Campaign Console Setup 0.1.0.exe`

On macOS, use:

- the packaged `.dmg` release once one is provided

If someone gives you the source repo instead of the packaged installer, that is the developer version, not the player-first install path.

## First Launch

When the app starts for the first time, go to `Setup`.

You will be asked for:

- `Game Campaign Path`
- `User Campaign Path`
- `Preferred Runtime Campaign ID`
- `Preferred Package ID`
- optional package source and output paths

### Typical Windows Paths

Game campaign path is usually:

```text
C:\Program Files (x86)\Steam\steamapps\common\Modern Naval Warfare\Var\Scenarios\Packages\Campaigns
```

User campaign path is usually:

```text
C:\Users\<YourUser>\AppData\LocalLow\WaveOps\ModernNavalWarfare\Scenarios\Packages\Campaigns
```

Save these once and the app will reuse them.

## Understanding The Three Workspaces

The app is split into three separate areas.

### Setup

Use this once to configure paths and defaults.

This is where you tell the app:

- where the installed game reads campaign packages from
- where your user profile stores campaign packages
- which campaign ID should be treated as the default runtime campaign
- which package ID should be treated as the default package namespace

### Authoring

Use this to create and package campaigns.

This workspace lets you:

- choose a campaign title
- choose a campaign ID
- choose a theater
- choose a tone
- choose a scenario count
- preview the generated campaign blueprint
- write campaign files
- build the package
- deploy the package

It also shows the pathing model and platform selection model used by the generator.

### Campaign Tracking

Use this after missions.

This workspace lets you:

- inspect the campaign summary
- inspect tracked units and persistence modules
- review recent result data
- review next-mission generation directives
- build a manual result JSON
- paste and parse debrief text into a draft result

Important:

- `Campaign Tracking` now uses real exported runtime data only
- it does not fall back to sample campaign state
- if no runtime snapshot exists yet, the app will show instructions instead of fake data

## Campaign ID vs Package ID

These usually match.

- `Campaign ID` is the runtime campaign identifier used by the tracker and persistence flow
- `Package ID` is the MNW package identifier used for build and deploy

Typical simple usage:

- campaign ID: `iron_archipelago`
- package ID: `iron_archipelago`

That produces mission namespaces like:

```text
iron_archipelago.iron_archipelago.bashi_screen
```

Only split these IDs if you intentionally know you are tracking one campaign state while building another package tree.

## How The Generator Works Without AI

The generator is deterministic and rule-based.

It does not call an AI model. Instead, it uses:

- theater templates
- side templates
- mission archetype sequences
- seeded variation

That means the same inputs will always produce the same campaign.

### Pathing

Each theater defines route corridors for things like:

- player movement
- enemy movement
- support movement
- helo or air search movement

The app then:

1. chooses a mission sequence based on the selected tone
2. creates a stable seed from your campaign settings
3. jitters the corridor anchor points within bounded limits
4. derives spawn points, contact datums, escorts, barrier or egress points, and withdrawal legs
5. advances timing and contact density across later scenarios

This keeps the campaign believable without needing external AI tooling.

### Platform Selection

Theater choice drives side selection and baseline units.

For example:

- `Luzon Strait`
  - player side: U.S. submarine
  - opposing side: PLAN surface combatants
- `South China Sea`
  - player side: U.S. submarine
  - opposing side: Russian submarines

Tone changes the scenario sequence and pacing. It does not swap the sides or the theater family.

## Typical Use Flow

For a first-time player or operator:

1. install the desktop app
2. open `Setup`
3. set the MNW paths
4. save settings
5. open `Authoring`
6. preview a campaign
7. write campaign files
8. build the package
9. deploy the package
10. launch MNW and play
11. return to `Authoring` and use `Export Runtime Snapshot` once the campaign exists in MNW
12. open `Campaign Tracking` to inspect the exported real state
13. after each mission, ingest a result JSON or use the result-builder workflow
14. export or refresh runtime again as needed

## If Something Looks Wrong

Check these first:

- your game path is correct
- your user campaign path is correct
- your runtime campaign ID and package ID are what you intend
- the package was built before deployment
- the package was deployed after the latest build

If the app launches but cannot find campaign files, the most common cause is a path or ID mismatch.

## Advanced Users

The original PowerShell and Python workflows still exist in the repo for advanced users and developers.

Those are not required for normal desktop-app use.
