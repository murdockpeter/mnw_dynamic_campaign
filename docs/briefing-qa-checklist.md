# Briefing QA Checklist

Use this checklist when reviewing a newly generated or continued campaign mission in the desktop flow.

## Core Questions

- Can a tester explain what the submarine is expected to accomplish in one sentence?
- Can a tester identify what they may shoot and what they must not shoot?
- Can a tester identify the designated target, if one exists?
- Can a tester explain what ends the mission?
- Does the mission success text describe an operational result instead of generic report receipt?

## Briefing Fields

- `Mission Type` matches the intended operational problem.
- `Scenario Time` matches the selected season and time-of-day policy when one was chosen explicitly.
- `Alert State` matches the campaign escalation level.
- `Rules Of Engagement` match the authorized engagement language in the objective text.
- `Mission Stance` matches the search/intercept bias shown in geometry and briefing language.
- `Designated Target` is either a named target or explicitly says no specific target is designated.
- `Expected Action` tells the player how to approach the problem, not just to use judgment.
- `End State` tells the player when to recover.

## Arc Checks

- Early surveillance missions keep ROE and language restrained.
- Strike missions include explicit attack orders.
- Post-strike or break-contact missions prioritize survival and withdrawal.
- Continuation missions reflect the prior mission outcome in escalation or command language.

## Variety Checks

- Generate at least two campaigns with the same theater, climate, and mission type and confirm they do not read like trivial rewrites of one another.
- Compare route summaries, sector labels, designated targets, and support composition across those campaigns.
- Confirm at least one mission in the arc changes task emphasis beyond simple `classify -> strike -> escape` repetition.
- Confirm continuation scenarios feel tied to the prior result rather than like a generic re-roll of mission one.

## Theater Tracking Checks

- `Campaign Tracking` exposes theater, escalation, ROE, mission type, season/time-of-day, and player submarine without opening raw JSON.
- Sector pressure cards show believable tracked/on-stage/enemy counts for the active theater.
- Theater unit cards show current sector, readiness, damage, availability, and on-stage state without obvious contradictions.
- Sidebar `Tracking Snapshot` stays compact and does not compete with the main theater picture for attention.

## Player Submarine Checks

- The selected Virginia block appears in authoring state, runtime tracking, and regenerated continuation context.
- The selected Virginia block resolves to a verified distinct MNW hull entry rather than a shared Block III fallback.
- Mission scripts reflect the selected player unit name and player label such as `(Player) USS Test | Virginia B2`.
- Existing campaigns created before submarine selection still load without broken tracking or missing player-unit metadata.

## Theater Flavor

- Pacific theaters use `COMSUBPAC`.
- Atlantic or Norwegian theaters use `COMSUBLANT`.
- No briefing or success text falls back to generic `Higher command` when theater authority is known.

## Manual Flow

1. Generate a campaign in `Authoring`.
2. Open the produced mission JSON or locale text and read the briefing.
3. Export runtime, save a mission result, and use `Continue Campaign`.
4. Inspect `Campaign Tracking` before entering a result and confirm theater picture, sector pressure, and unit cards make operational sense.
5. Read the regenerated mission briefing and compare the escalation, ROE, success language, and scenario time to the previous mission.
6. Repeat with a second campaign using the same broad settings to judge freshness.
7. Record any mismatch between briefing authority, mission type, theater tracking, and generated force composition.
