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

## Theater Flavor

- Pacific theaters use `COMSUBPAC`.
- Atlantic or Norwegian theaters use `COMSUBLANT`.
- No briefing or success text falls back to generic `Higher command` when theater authority is known.

## Manual Flow

1. Generate a campaign in `Authoring`.
2. Open the produced mission JSON or locale text and read the briefing.
3. Export runtime, save a mission result, and use `Continue Campaign`.
4. Read the regenerated mission briefing and compare the escalation, ROE, and success language to the previous mission.
5. Record any mismatch between briefing authority, mission type, and generated force composition.
