# Persistence TODO

## Current Roadmap Status (0.1.5)

The original persistence milestone, beta-feedback backlog, and 0.1.4 feature backlog are implemented. The unchecked 0.1.4 task detail below is retained as historical acceptance criteria; the code and automated tests are the current source of truth.

Completed in 0.1.5:

- [x] Add schema validation for mission results, campaign state, and module configuration.
- [x] Add atomic JSON writes, timestamped backups, and changed-on-disk conflict protection.
- [x] Add guarded state-backup discovery and restore from Campaign Tracking.
- [x] Add `.kyt` deployment preflight that blocks duplicate campaign and mission identities.
- [x] Add a discoverable persistence-module registry and campaign module controls.
- [x] Make the portable runtime honor disabled damage and ammunition modules.
- [x] Add advanced result events, explicit time advancement, and pre-save state-delta preview.
- [x] Add a guarded structured state editor for mission, clock, world state, unit state, ammunition, and theater assignment.
- [x] Add an append-only operator audit log.
- [x] Add redacted support-bundle export with settings, workflow, runtime, and Player.log tail.
- [x] Add settings schema versioning and upgrade-safe default migration.
- [x] Add locally indexed MNW DB hull suggestions to player-platform authoring.

Remaining release/content tracks:

- [x] Validate install and automatic update against a real tagged GitHub prerelease.
- [x] Expand local DB-informed selection beyond Virginia hulls into editable friendly, enemy, and support force pools.
- [x] Implement bespoke mission-objective scripts for Spec Ops, Counter-Piracy, and Counter-Terror experimental content; keep Land Attack gated until shore-target and weapon scripting are supportable.

Local force-pool selection now indexes the player's installed `.core` archive at runtime, normalizes selectable surface, subsurface, air, and merchant records, filters them by theater side and campaign year, and exposes editable pools in Advanced Authoring. Selected pools drive both mission families, persist into campaign/bootstrap/continuation state, and honor permanent unit losses. No extracted MNW database catalog is bundled with the installer.

This is the agreed line in the sand for the first persistence milestone.

Do not expand scope beyond these items until all are implemented and tested working properly.

## Milestone

1. Build the core state schema.
2. Add JSON storage.
3. Add a normalized mission result format.
4. Add a tiny runtime that loads enabled modules.
5. Implement two first modules:
   - `damage`
   - `ammo`
6. Add a simple next-mission generator hook.
7. Test the full loop end to end.

## Design Rules

- Persistence lives outside MNW.
- Persistence systems must be modular and selectable by configuration.
- The core runtime must not hardcode one campaign system.
- Modules mutate shared state and contribute generation directives.
- Mission/package writing remains a separate concern from persistence logic.

## Status

- [x] 1. Core state schema
- [x] 2. JSON storage
- [x] 3. Normalized mission result format
- [x] 4. Tiny runtime with module loading
- [x] 5. First modules: `damage`, `ammo`
- [x] 6. Simple next-mission generator hook
- [x] 7. Test the full loop end to end

## Notes

- Smoke test passed via `python -m unittest tests.test_persistence_smoke`.
- The current implementation is a scaffold for pluggable persistence systems, not a final gameplay ruleset.

## Beta Feedback Backlog

This is the next implementation track after the persistence milestone. The focus is mission clarity, realistic terminology, stronger operational arcs, and explicit player tasking.

Work these top to bottom. Do not start lower-priority generator expansion until the language and expectation-setting problems are fixed and tested.

### 1. Replace abstract campaign labels with operational language

- [x] Rename or reframe `tone` in the authoring UI and generated metadata to a player-facing escalation concept such as `Alert Level`, `Conflict State`, or `Campaign Climate`.
- [x] Rename or reframe `posture` in the authoring UI and generated briefs to a player-facing `Rules of Engagement` or `Mission Stance` concept where appropriate.
- [x] Audit generated labels, help text, and docs so the player can infer expected behavior without understanding internal generator jargon.
- [x] Keep backward compatibility for stored specs and continuation state where possible, even if the displayed labels change first.

Implementation targets:
- `ui/index.html`
- `ui/app.js`
- `shared/campaign-generator.mjs`
- `portable/generate-campaign.mjs`
- `DEVELOPER_GUIDE.md`
- `DESKTOP_APP_GUIDE.md`

Acceptance checks:
- Wizard labels describe what the player is expected to do.
- Generated mission briefing text no longer relies on unexplained `tone` or `posture` wording.
- Existing saved campaigns still load without manual migration.

Status:
- Implemented in UI, generator metadata, runtime state, CLI args, and docs.

### 2. Introduce explicit escalation states across a campaign arc

- [x] Define a campaign escalation model such as `peacetime`, `heightened_tension`, `crisis`, `open_warfare`.
- [x] Persist escalation state in generated campaign metadata and runtime continuation state.
- [x] Make continuation logic capable of escalating, holding, or de-escalating state based on mission outcomes.
- [x] Reflect escalation state in mission briefings, diplomacy settings, objective framing, and scenario composition.

Implementation targets:
- `shared/campaign-generator.mjs`
- `portable/lib/continue-campaign.mjs`
- `portable/lib/generated-campaign-files.mjs`
- `portable/lib/runtime.mjs`
- `tests/`

Acceptance checks:
- Mission N+1 can reflect mission N outcome in briefing language and scenario setup.
- State progression is visible in runtime JSON and generated campaign files.
- Failure and success paths both produce believable next-step states.

Status:
- Generator, continuation state, runtime payloads, briefings, and mission scripts now carry escalation.
- Mission-script tension mapping is validated against stock MNW campaign and single-mission content from the installed game.

### 3. Add explicit Rules of Engagement modeling

- [x] Define ROE states such as `weapons_tight`, `targets_of_opportunity`, `free_fire_on_hostile_flagged_units`.
- [x] Separate ROE from mission objective type so a surveillance mission can still occur under a tense ROE and vice versa.
- [x] Map generated ROE state to briefing language and, where possible, mission script diplomacy settings.
- [x] Make ROE visible in campaign tracking and generated debug payloads.

Implementation targets:
- `shared/campaign-generator.mjs`
- `portable/lib/generated-campaign-files.mjs`
- `portable/lib/runtime.mjs`
- `ui/app.js`

Acceptance checks:
- Briefings state engagement authority clearly.
- Generated scenarios can differ meaningfully between surveillance-only and engagement-authorized missions.
- Runtime/debug output exposes the selected ROE for inspection.

Status:
- ROE modeling is implemented in generation, state, tracking, and mission scripts.
- Mission-script ROE mapping is validated against stock MNW campaign and single-mission content from the installed game.

### 4. Make attack orders explicit and mission-ending guidance specific

- [x] Audit mission order generation to ensure some arcs culminate in explicit attack directives, not only surveillance language.
- [x] Add objective templates for stalk, classify, trail, sink designated HVT, break contact, and escape/evasion.
- [x] Ensure the generated orders identify the target class or named target when the mission requires destruction.
- [x] Add post-attack escape or withdrawal tasking where appropriate.

Implementation targets:
- `shared/campaign-generator.mjs`
- `portable/lib/generated-campaign-files.mjs`
- generated scenario content under `src/package*` and `src/packages/*`

Acceptance checks:
- At least one supported arc can culminate in a clearly worded kill mission.
- Attack missions name the target and desired result in the orders.
- Follow-on missions can shift to evasion, regroup, or battle damage exploitation.

Status:
- Implemented in generator logic and mission briefings.
- Still worth regression testing as new mission types and command flavor are added.

### 5. Improve command flavor text by theater

- [x] Replace generic completion text like `Higher command` with theater-appropriate command authorities.
- [x] Centralize authority mapping such as `COMSUBPAC` for Pacific and `COMSUBLANT` for Atlantic theaters.
- [x] Audit mission-from headers, completion text, and follow-on summaries for consistency.

Implementation targets:
- `shared/campaign-generator.mjs`
- `portable/lib/generated-campaign-files.mjs`
- `src/package/locale.csv`
- `src/packages/*/locale.csv`

Acceptance checks:
- Pacific theaters consistently use `COMSUBPAC`.
- Atlantic/Norwegian theaters consistently use `COMSUBLANT`.
- No generated completion string uses generic `Higher command` where a command authority is known.

Status:
- Implemented in generator output, package writing, and seeded locale content.

### 6. Add mission-type selection as an authoring control

- [x] Add a mission-type selector in the wizard for options such as `ASW`, `ASuW military`, `ASuW convoy`, `submerged escort`, `civilian defense`, `blockade relief`, `land attack`.
- [x] Define which mission types are currently supported, partially supported, or future placeholders.
- [x] Use mission type to bias force composition, objectives, and briefing language.
- [x] Validate unsupported combinations cleanly instead of silently generating a weak fit.

Implementation targets:
- `ui/index.html`
- `ui/app.js`
- `shared/campaign-generator.mjs`
- `portable/generate-campaign.mjs`
- docs

Acceptance checks:
- The wizard exposes mission type as a first-class choice.
- Generated forces and tasks differ materially by selected mission type.
- Unsupported mission types are labeled clearly in UI and docs.

Status:
- Implemented with support levels (`supported`, `partial`, `future`) and fallback warnings.
- Stable mission-type biasing remains lightweight. Experimental Spec Ops, Counter-Piracy, and Counter-Terror now have distinct completion/failure scripting and task annotations; Land Attack remains a future placeholder.

### 7. Strengthen generated orders and player expectation-setting

- [x] Rewrite briefing templates so the primary task, engagement authority, and end condition are unambiguous.
- [x] Reduce generic phrasing like `use judgment` unless paired with concrete objectives.
- [x] Add examples of expected player actions in the briefing language where it improves clarity.
- [x] Review summary text, mission completion text, and tracking panels for player-facing clarity.

Implementation targets:
- `portable/lib/generated-campaign-files.mjs`
- `shared/campaign-generator.mjs`
- `ui/app.js`

Acceptance checks:
- A tester can read the briefing and answer: what am I looking for, what may I shoot, what ends the mission?
- Mission completion text reflects what happened operationally, not only that a report was received.

Status:
- Implemented in generated mission objectives, success text, and tracking summaries.

### 8. Add test coverage for generator language and state transitions

- [x] Add fixture-based tests for briefing text, command authority naming, escalation state, and ROE rendering.
- [x] Add continuation tests that verify mission outcome can alter follow-on escalation and tasking.
- [x] Add snapshot-style tests for at least one surveillance arc and one strike arc.
- [x] Add manual QA scripts for reading generated orders in the desktop flow.

Implementation targets:
- `tests/`
- `generated/ui/*.json` fixtures as needed
- docs for manual QA

Acceptance checks:
- Automated tests fail if generic or invalid command language regresses.
- Automated tests cover both initial generation and continuation generation.
- Manual QA checklist exists for the briefing clarity pass.

Status:
- Implemented via `tests/test_campaign_generation.mjs`, snapshot fixtures, and `docs/briefing-qa-checklist.md`.

### 9. Research backlog and deferred ideas

- [x] Evaluate whether external plot seeding should come from curated templates rather than open-ended movie/news scraping.
- [x] Track future mission families such as spec ops, counter-piracy, and counter-terror separately from the current supported set.
- [x] Confirm whether land attack is technically supportable in the current game scripting pipeline before exposing it as fully supported.

Notes:
- External news/movie ingestion is out of scope for the next implementation pass.
- New mission families should be gated behind concrete support in mission generation and MNW scripting, not only prompt ideas.

Status:
- Implemented as an experimental-content track with an explicit UI toggle and curated plot-seed catalog.
- Experimental mission families remain separate from the stable supported set and surface warnings instead of silent weak-fit generation. Spec Ops, Counter-Piracy, and Counter-Terror use bespoke objective scripts when enabled.
- Land attack is now called out as not technically supported by the current generator or MNW mission-script pipeline and continues to fall back safely.

## Release 0.1.4 Backlog

This is the implementation backlog for release `0.1.4`.

The theme for this pass is increased scenario freshness, stronger theater-level continuity, tighter player-facing controls, and a less cluttered desktop workflow.

Recommended execution order:

1. Expand scenario variety in the generator.
2. Add selectable player submarine block support.
3. Add season and time-of-day authoring controls.
4. Promote theater tracking into a first-class tracking area.
5. Hide or demote lower-value UI areas.
6. If time remains, harden GitHub release auto-update support.

### 0.1.4-1. Continue adding variety to generated scenarios

- [x] Expand route and geometry variation inside each theater so repeat runs do not feel too similar when the same climate and mission type are selected.
- [x] Add more mission-task permutations within existing supported families instead of relying mainly on the current archetype sequence.
- [x] Increase force-composition variety using existing support pools, sector assignments, support intensity controls, and escalation/ROE state.
- [x] Make continuation scenarios react more visibly to prior mission count, prior outcome, and prior theater picture so the operation feels less reset between missions.
- [x] Audit generated summary, objective, and success text for repeated phrasing that beta testers are likely reading across multiple generated campaigns.

Implementation targets:
- `shared/campaign-generator.mjs`
- `portable/lib/generated-campaign-files.mjs`
- `portable/lib/continue-campaign.mjs`
- `tests/test_campaign_generation.mjs`
- `docs/briefing-qa-checklist.md`

Acceptance checks:
- Two campaigns generated with the same theater and broad settings can still differ materially in route flavor, force mix, and task framing.
- Follow-on scenarios feel like operational evolution rather than a lightly reworded first mission.
- Variety improvements do not break determinism for the same authored spec and seed inputs.
- Automated tests cover at least one additional variety-sensitive scenario path beyond the current baseline snapshots.

### 0.1.4-2. Begin expanding the campaign aspects into a full theater tracking area

- [x] Promote exported `runtime.theater` data from debug/support output into a first-class Campaign Tracking surface.
- [x] Add sector-level visibility for the current theater so the player can see where tracked units are assigned or last known.
- [x] Add tracked-unit summaries for availability, readiness, destroyed state, last assigned mission, and current sector.
- [x] Make escalation, ROE, mission type, mission stance, and experimental-state context visible in the theater tracking area.
- [x] Decide which theater details are read-only release UI versus developer/debug-only detail and hide or collapse the rest.

Implementation targets:
- `portable/lib/runtime.mjs`
- `ui/index.html`
- `ui/app.js`
- `ui/styles.css`
- `docs/beta-tester-feature-overview.html`

Acceptance checks:
- Campaign Tracking shows theater-level context without requiring the user to inspect raw JSON.
- A tester can answer what theater they are in, what the current operational state is, and which units are currently relevant from the tracking screen alone.
- Theater tracking still loads cleanly for bootstrap state and continued campaigns.
- No critical tracking action becomes harder to find because of the added theater surface.

### 0.1.4-3. Continue to hide things in the UI that may no longer need to be front and center

- [x] Audit Setup, Authoring, and Campaign Tracking for panels, helper text, and placeholders that were useful during scaffolding but now dilute the main workflow.
- [x] Remove or demote visibly speculative UI such as future-area lists or redundant explanatory copy where the workflow is already established.
- [x] Collapse lower-frequency controls behind secondary affordances where doing so does not hide core release functionality.
- [x] Rebalance the layout so the main loop actions remain more prominent than diagnostics or secondary status panels.
- [x] Verify that desktop-only actions still fail clearly in browser mode without cluttering the interface.

Implementation targets:
- `ui/index.html`
- `ui/app.js`
- `ui/styles.css`
- `ui/README.md`

Acceptance checks:
- The first-use path remains obvious: Setup, Authoring, then Campaign Tracking.
- The primary release workflow requires less scanning and less explanatory reading than the current UI.
- No release-critical control is removed; only its prominence changes where appropriate.
- Browser mode and desktop mode still communicate capability differences clearly.

### 0.1.4-4. Allow choice of which block Virginia sub is the player's command

- [x] Introduce a player-submarine catalog instead of hardcoding the current Block III path.
- [x] Expose a wizard control for player submarine selection with clear user-facing naming.
- [x] Persist the chosen submarine variant into generated blueprint data, campaign metadata, bootstrap state, and continuation state.
- [x] Drive mission-script player naming and DBID selection from the chosen submarine variant in both initial and continuation scenario writers.
- [x] Ensure seeded sample packages and generated packages remain valid if older state does not include the new field.

Implementation targets:
- `shared/campaign-generator.mjs`
- `portable/lib/generated-campaign-files.mjs`
- `portable/lib/runtime.mjs`
- `ui/index.html`
- `ui/app.js`
- `tests/test_campaign_generation.mjs`

Acceptance checks:
- The player can choose among the intended Virginia block variants during authoring.
- Generated mission scripts no longer hardcode `Virginia B3` when another variant is selected.
- Existing campaigns without submarine-selection metadata still load with a safe default.
- Runtime and tracker views show the selected player platform correctly.

### 0.1.4-5. Add seasonal and time-of-day control for generated scenarios

- [x] Add authoring controls for season and time-of-day policy in the wizard.
- [x] Decide whether the control is fixed-per-campaign, selected-per-scenario, or policy-driven with limited generator freedom, then implement that consistently.
- [x] Persist the selected season/time-of-day values through blueprint generation, bootstrap state, runtime state, and continuation generation.
- [x] Map those settings into scenario clock generation and player-facing mission briefing language.
- [x] Ensure continuation scenarios respect the chosen temporal policy instead of drifting into inconsistent clocks.

Implementation targets:
- `shared/campaign-generator.mjs`
- `portable/lib/generated-campaign-files.mjs`
- `portable/lib/continue-campaign.mjs`
- `portable/lib/runtime.mjs`
- `ui/index.html`
- `ui/app.js`
- `tests/test_campaign_generation.mjs`

Acceptance checks:
- The user can intentionally generate night, dawn/dusk, day, or seasonally biased scenarios instead of relying on the current implicit clocking.
- Generated mission scripts reflect the expected scenario time.
- Briefings or tracking output expose the selected temporal context clearly enough for QA.
- Continuation generation preserves the intended temporal rules unless the design explicitly allows change.

### 0.1.4-6. If time allows, provide a first usable GitHub release auto-upgrade path

- [x] Audit the existing updater implementation to confirm what is already release-ready versus still provisional.
- [x] Validate the packaged-app path for update-source configuration, manual check, download, and restart-to-install behavior.
- [x] Confirm GitHub Releases defaults are sensible for the intended public distribution path.
- [x] Add or extend tests around settings persistence and any updater-related edge cases that can be covered without a packaged live release.
- [x] Tighten user-facing status text and docs so non-technical testers understand what is supported in packaged builds versus source mode.

Live validation completed on 2026-08-15 using public GitHub prereleases `v0.1.5` and `v0.1.6`. The public 0.1.5 installer matched its `latest.yml` SHA-512, installed successfully, discovered 0.1.6 through the GitHub provider with preview releases enabled, downloaded the update, invoked restart-to-install, registered version 0.1.6, and passed the packaged smoke test after replacement. `tools/validate-live-updater.mjs` preserves the check/download/install validation path for future releases.

Implementation targets:
- `.github/workflows/release.yml`
- `electron/main.cjs`
- `electron/preload.cjs`
- `portable/lib/settings-store.mjs`
- `portable/lib/desktop-api.mjs`
- `ui/index.html`
- `ui/app.js`
- `tests/test_settings_store.mjs`
- `README.md`
- `DESKTOP_APP_GUIDE.md`

Acceptance checks:
- The packaged Electron app can point at GitHub Releases and present a coherent update flow.
- Source-mode behavior remains explicit that auto-update is unsupported there.
- Release docs match the actual build and updater behavior.
- This item can slip without blocking `0.1.4` if the core scenario/tracking work needs the time.
