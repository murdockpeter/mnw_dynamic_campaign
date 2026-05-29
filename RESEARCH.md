# Modern Naval Warfare Content Recon

Date: 2026-05-26

## Install layout

Game root inspected:

- `C:\Program Files (x86)\Steam\steamapps\common\Modern Naval Warfare`

Important subtrees:

- `Var\Scenarios`
- `Var\DB`
- `Var\GIS`
- `Var\Scripts`
- `mnw_Data\Managed`
- `mnw_Data\StreamingAssets`

`Var\package.json` exposes path semantics used by the game:

- `OfficialScenarios = Scenarios`
- `CommunityScenarios = Scenarios`
- `DB = DB`
- `GIS = GIS`
- `UserProfiles = Profiles`
- `Saves = Saves`

It also points to a user data root:

- `UserData = .MaslasBros/MNW`

## Scenario packaging

Official scenarios are shipped as ZIP containers, not opaque binaries.

Files found:

- `Var\Scenarios\Packages\Campaigns\campaigns.kyt`
- `Var\Scenarios\Packages\Missions\single_missions.kyt`

Both start with ZIP signature `PK 03 04`.

### Campaign package contents

Representative entries inside `campaigns.kyt`:

- `manifest.json`
- `locale.csv`
- `template.mis.json`
- `template.cmp.json`
- `rainbow_panda/quest.cmp`
- `rainbow_panda/quest.cmp.json`
- `rainbow_panda/m1_aukus.mis`
- `rainbow_panda/m1_aukus.mis.json`

### Mission package contents

Representative entries inside `single_missions.kyt`:

- `manifest.json`
- `locale.csv`
- `template.mis.json`
- `single_missions/asw_training_easy.mis`
- `single_missions/asw_training_easy.mis.json`

## Scenario file format

The actual mission and campaign files are plain text scripts.

### `.cmp`

`quest.cmp` is a text campaign script. Example pattern:

- defines globals like `_version`, `_author`, `_difficulty_level`
- creates a starting mission with `Mis("campaigns.rainbow_panda.m1_aukus")`
- chains missions with `.PipeMission("...")`

This strongly suggests the campaign graph is script-defined and generator-friendly.

### `.mis`

`m1_aukus.mis` is also plain text and looks like Python/Jython-style mission construction code.

Observed features:

- scenario globals:
  - `_operation_type`
  - `_date_time`
  - `_weather`
- faction setup:
  - `_diplomacy.AddFactions(...)`
  - `_diplomacy.SetTensionLevel(...)`
- objective setup:
  - `Obj(...)`
- entity spawning:
  - `Element.Props.FromElementID(...)`
  - `Element.Props.FromDatabaseID(...)`
  - `_P.Element.Spawn(...)`
- weapon/arsenal setup:
  - `_P.Element.Arsenal(...)`
  - `_P.Element.PreloadArsenal(...)`
- messages and POIs:
  - `MessageModel(...)`
  - `PointOfInterest(...)`
- AI/search assignments:
  - `AITools.SearchArea(...)`
  - `Assignments.ASW(...)`

This is the core breakthrough: the mission layer is not a binary editor format. It is authored as text.

## Localization sidecars

Each `.mis` or `.cmp` has a JSON sidecar plus package-level `locale.csv`.

Observed behavior:

- `.mis.json` and `.cmp.json` contain localized metadata fields like:
  - `name`
  - `description`
  - `objectives`
  - `messages`
- string payloads are base64-encoded in those JSON files
- `locale.csv` contains decoded plain-text rows keyed by path + field

This gives us at least two viable generation targets:

1. generate script files plus sidecar JSON
2. generate script files plus `locale.csv`, then derive sidecars if needed

## Database packaging

Database files are also ZIP containers.

Files found:

- `Var\DB\cdb4dddcc476baee0c1b.core` (~336 MB)
- `Var\DB\523817e10cbb78ff1cf3.ais` (~50 MB)

Both start with ZIP signature `PK 03 04`.

### Core DB contents

Representative entries:

- `aircrafts.msg`
- `ships.msg`
- `missiles.msg`
- `torpedoes.msg`
- `projectiles.msg`
- `expendables.msg`
- many related JPG images under category folders

The `.msg` payloads are not text, but their headers and embedded strings are consistent with MessagePack-encoded records.

Visible sample content confirms platform names/descriptions are present in the packed data, e.g.:

- aircraft entry strings like `Harbin Z-9C`
- ship entry strings like `Ticonderoga Baseline 2`
- missile entry strings like `RGM-184A NSM`

### AIS DB contents

Representative entries:

- `ais_data_0.msg` through `ais_data_64.msg`
- `manifest.json`

These `.msg` chunks also appear to be MessagePack payloads.

## Script/runtime clues

The shipped scripting layer references scenario namespaces directly:

- `mnw.Scenarios`
- `mnw.Scenarios.Missions`
- `mnw.Scenarios.Missions.Assignments`
- `mnw.Scenarios.Missions.Zones`

The shipped script packages also include a bundled `msgpack` implementation under:

- `Var\Scripts\Execute\_StdLibs\msgpack`

That matters because it confirms MessagePack is part of the game’s own content/tooling ecosystem, not just a coincidence in file signatures.

## Feasibility assessment

Yes, there is enough locally accessible information to build a campaign generator.

Reasoning:

1. Scenario and campaign assets are ZIP packages containing plain-text scripts.
2. Mission scripts directly expose scenario-building primitives instead of hiding them in serialized Unity assets.
3. Platform databases are accessible archives and appear parseable as MessagePack.
4. Package manifests, templates, and localization files are all present.

## Main unknowns

These are engineering questions, not blockers:

1. Exact MessagePack schema for each DB category.
2. Whether custom scenarios should live in the install tree, user data tree, or both.
3. Whether campaign graphs support conditional branching beyond simple `PipeMission(...)`.
4. Whether packaging requires recomputing only ZIP contents and manifests, or also some registry/cache step.

## Practical next steps

1. Build a read-only extractor that:
   - opens `.kyt`, `.core`, and `.ais` as ZIP files
   - reads `manifest.json`, `locale.csv`, `.mis`, `.cmp`, and `.msg`
2. Implement MessagePack decoding for DB payloads.
3. Normalize mission scripts into a structured internal model:
   - factions
   - start date/weather
   - spawned units
   - objectives
   - messages
   - AI assignments
4. Generate a minimal custom mission package and verify the game loads it.
5. Extend from single mission generation to multi-mission campaign graph generation.

## Bottom line

This looks materially more tractable than a game that stores scenarios only in proprietary binary blobs. The biggest remaining job is schema extraction, not format discovery.
