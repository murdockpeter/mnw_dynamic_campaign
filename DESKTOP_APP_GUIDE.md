# Desktop App Guide

This guide is for players or operators who want to use the packaged `MNW Campaign Console` desktop app without building anything from source.

## What This App Is For

The desktop app is a packaged frontend and workflow wrapper for the dynamic campaign tooling in this repo.

It lets you:

- configure where `Modern Naval Warfare` stores campaign packages
- generate a deterministic campaign without bringing your own AI tooling
- build and deploy the generated campaign package
- inspect exported campaign runtime state
- save mission results directly in the app after missions
- review the operational area map inside the app
- refresh and inspect a live AISStream sample for the current theater
- continue the campaign by rewriting the reserved next mission from the latest saved result

You do not need:

- Python
- PowerShell
- Node.js
- npm

## What To Install

On Windows, use:

- `MNW Dynamic Campaign Console Setup 0.1.2.exe`

On macOS, use:

- the packaged `.dmg` release once one is provided

If someone gives you the source repo instead of the packaged installer, that is the developer path, not the player-first install path.

## First Launch

When the app starts for the first time, go to `Setup`.

You will be asked for:

- `Game Campaign Path`
- `User Campaign Path`
- `Preferred Runtime Campaign ID`
- `Preferred Package ID`
- optional package source and output paths
- optional AISStream settings

### Typical Windows Paths

Game campaign path is usually:

```text
C:\Program Files (x86)\Steam\steamapps\common\Modern Naval Warfare\Var\Scenarios\Packages\Campaigns
```

User campaign path is usually:

```text
C:\Users\<YourUser>\AppData\LocalLow\WaveOps\ModernNavalWarfare\Scenarios\Packages\Campaigns
```

On first launch, the app will try to detect these automatically before you save anything.

If you want to run the scan again, use the `Find Paths` button on the `Setup` page. It will try to:

- find the installed MNW campaign folder from the local Steam install
- find your user campaign folder under the current Windows profile
- fill the package source and output paths from the app's writable workspace

Important:

- the user-folder scan uses the Windows account that is currently running the app
- it does not search other users' personal `AppData\LocalLow` campaign folders

After that, review the filled paths and click `Save Desktop Settings`.

## Understanding The Three Workspaces

The app is split into three separate areas.

### Setup

Use this once to configure paths and defaults.

This is where you tell the app:

- where the installed game reads campaign packages from
- where your user profile stores campaign packages
- which campaign ID should be treated as the default runtime campaign
- which package ID should be treated as the default package namespace
- whether package ID should mirror campaign ID automatically
- whether AISStream sampling is enabled
- what AIS query radius to use
- what AISStream API key to store locally

Notes:

- the AIS token is stored in desktop settings on your machine
- the token is not written into generated campaign package files
- the `Find Paths` button can auto-fill the most common Windows path fields before you save
- the `Use Latest Generated Campaign` button can repoint the saved defaults to the newest generated package tree

### Authoring

Use this to create and package campaigns.

This workspace lets you:

- choose a campaign title
- choose a campaign ID
- choose a theater
- choose a campaign climate
- choose a mission type
- choose a start year
- choose a scenario count
- choose a mission stance
- choose rules of engagement
- choose a player unit name
- optionally set `Max Scenario Radius (km)` to compress generated mission geometry around the player start
- write campaign files
- build the package
- deploy the package

Current theater families include:

- `Luzon Strait`
- `South China Sea`
- `Norwegian Sea`

Important:

- `Scenario Count` currently starts at `2` or more because the app keeps a reserved follow-on mission slot in the package
- the first mission is intended to be playable
- the next mission slot is intentionally present so MNW always has a valid next mission node
- that reserved next mission is meant to be rewritten from `Campaign Tracking` before the player launches it

### Campaign Tracking

Use this after missions.

This workspace lets you:

- export the current runtime snapshot from the live campaign
- inspect exported campaign metadata and persistent state
- enter and save a manual mission result directly into campaign state
- parse debrief text into a draft result payload
- open the theater operational map inside the app and return to the tracker
- choose a next objective, risk posture, and operational tempo
- rewrite the reserved next scenario from the latest mission result
- refresh and inspect a live AIS sample for the current theater
- open advanced detail for recent results, persistent units, the embedded operational map, and parser tools

Important:

- `Campaign Tracking` now uses exported runtime data only
- it does not fall back to sample campaign state
- if no runtime snapshot exists yet, the app shows instructions instead of fake data
- the normal loop is now: `Export Runtime Snapshot` -> `Save Result To Campaign` -> `Continue Campaign`

## Campaign ID vs Package ID

These usually match.

- `Campaign ID` is the runtime campaign identifier used by the tracker and persistence flow
- `Package ID` is the MNW package identifier used for build and deploy

Typical simple usage:

- campaign ID: `norwegian_shadow`
- package ID: `norwegian_shadow`

That produces mission namespaces like:

```text
norwegian_shadow.norwegian_shadow.bear_gap
```

Only split these IDs if you intentionally know you are tracking one campaign state while building another package tree.

## How The Generator Works Without AI

The generator is deterministic and rule-based.

It does not call an AI model. Instead, it uses:

- theater templates
- side templates
- mission archetype sequences
- seeded variation
- bounded geometry constraints

That means the same inputs will always produce the same campaign or continuation scenario.

### Pathing

Each theater defines route corridors for things like:

- player movement
- enemy movement
- support movement
- helo or air search movement

The app then:

1. chooses a mission sequence based on the selected campaign climate
2. creates a stable seed from your campaign settings
3. jitters the corridor anchor points within bounded limits
4. derives spawn points, contact datums, escorts, barrier or egress points, and withdrawal legs
5. advances timing and contact density across later scenarios
6. applies a deconfliction pass so generated placements do not collapse onto the same point

### Max Scenario Radius

`Max Scenario Radius (km)` is optional.

Use it when you want to keep the generated mission footprint tighter around the player start. This is mainly a pacing control for MNW, where long transits can drag because time compression is limited.

Current behavior:

- non-AIS generated scenario elements are compressed inward to respect the setting
- continuation scenarios inherit the saved radius constraint
- AIS-imported merchant traffic is not clipped to that radius; it can stay on the live contact geometry it was sampled from

### Placeholder Follow-On Mission

The current dynamic-campaign workaround depends on a reserved next mission slot.

This exists because MNW expects the campaign chain to already contain a valid next mission node.

Current behavior:

- the generated campaign includes a playable current mission
- the next mission slot is a placeholder with explicit instructions in its briefing
- `Continue Campaign` rewrites that placeholder based on the saved result from the previous mission
- the app then keeps another reserved slot behind it so the chain remains valid

If you do not want to continue, treat the previous completed mission as the campaign ending.

Do not launch the placeholder mission before rewriting it in `Campaign Tracking`.

## AISStream Support

AIS integration is optional.

Current behavior:

- the desktop app can request a live AISStream sample for the current theater center
- the latest sample is stored in local desktop settings
- generated campaigns can use that sample to seed named merchant traffic into scenarios
- the tracker can show AIS debug payloads and sampled contacts for review

Current limitation:

- this is primarily a traffic-seeding feature today
- it is not yet documented as a guaranteed one-for-one replacement for MNW's built-in in-sim AIS/responder behavior

## Typical Use Flow

For a first-time player or operator:

1. install the desktop app
2. open `Setup`
3. set the MNW paths
4. save settings
5. optionally enable AISStream and save the key locally
6. open `Authoring`
7. preview or review the campaign summary
8. write campaign files
9. build the package
10. deploy the package
11. launch MNW and play the first mission
12. return to `Campaign Tracking`
13. click `Export Runtime Snapshot`
14. enter the mission changes that matter in `Step 2: Save Mission Result`
15. click `Save Result To Campaign`
16. if you want to continue, use `Step 3: Continue Campaign` to rewrite the reserved next mission
17. export or refresh runtime again as needed

### Recommended Dynamic Use

If you want the campaign to grow from mission results and player choices, the clean current flow is:

1. generate the campaign
2. play the current mission only
3. open `Campaign Tracking`
4. click `Export Runtime Snapshot`
5. enter the mission outcome and click `Save Result To Campaign`
6. choose:
   - next objective
   - risk posture
   - operational tempo
7. click `Continue Campaign`
8. let the app rewrite the reserved next mission, rebuild, redeploy, and refresh tracking state
9. launch the regenerated next mission in MNW
10. repeat after the next mission if you want to keep extending the campaign

### Campaign Tracking Layout

The current tracker is intentionally arranged as a simple three-step loop:

1. `Step 1: Load Current Campaign`
   Use `Export Runtime Snapshot`.
2. `Step 2: Save Mission Result`
   Enter the mission changes and click `Save Result To Campaign`.
3. `Step 3: Continue Campaign`
   Choose the next intent and rewrite the next mission slot.

If you want more detail, open `Advanced Campaign Detail` for:

- recent normalized result data
- persistent unit state
- the theater operational area map
- debrief text parser
- AIS debug payloads
- latest desktop action payload

## If Something Looks Wrong

Check these first:

- your game path is correct
- your user campaign path is correct
- your runtime campaign ID and package ID are what you intend
- the package was built before deployment
- the package was deployed after the latest build
- you are testing a newly generated or newly redeployed package, not an older cached one

If the app launches but cannot find campaign files, the most common cause is a path or ID mismatch.

If `Continue Campaign` does not produce the next mission you expect, check that:

- the runtime campaign ID points at the campaign you actually played
- the latest mission result was saved before extending
- the package deploy paths still point at the correct MNW install and user campaign folders
- you did not launch the placeholder mission before rewriting it

If the operational map does not load correctly, rebuild and reinstall the app before troubleshooting further. The embedded map relies on the packaged `docs` content being present in the installed build.

If a generated hostile submarine spawns badly, verify you are testing a fresh regenerated mission. Recent builds use shallow initial submerged depths plus an explicit dive process to avoid both surfaced spawns and deep seabed collisions.

If the next mission does not appear inside MNW immediately, remember that the continuation flow depends on:

- the current mission being completed in-game
- the latest result being saved into campaign state
- the reserved next mission being rewritten before play

## Advanced Users

The original PowerShell and Python workflows still exist in the repo for advanced users and developers.

Those are not required for normal desktop-app use.
