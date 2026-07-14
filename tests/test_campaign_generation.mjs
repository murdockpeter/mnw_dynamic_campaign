import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import {
  buildCampaignBlueprint,
  buildContinuationScenario
} from "../shared/campaign-generator.mjs";
import { buildScenarioPackageArtifacts } from "../portable/lib/generated-campaign-files.mjs";

function decodeBase64Field(field) {
  return Buffer.from(field.en, "base64").toString("utf8");
}

test("initial blueprint exposes campaign climate, ROE, escalation, and strike arc", () => {
  const blueprint = buildCampaignBlueprint({
    title: "Test Arc",
    campaignId: "test_arc",
    theater: "luzon_strait",
    campaignClimate: "surveillance",
    missionStance: "quiet_shadow",
    rulesOfEngagement: "weapons_tight",
    scenarioCount: 4,
    playerName: "USS Test"
  });

  assert.equal(blueprint.campaignClimate, "surveillance");
  assert.equal(blueprint.missionStance, "quiet_shadow");
  assert.equal(blueprint.rulesOfEngagement, "weapons_tight");
  assert.equal(blueprint.scenarioCount, 4);
  assert.equal(blueprint.totalScenarioCount, 5);
  assert.equal(blueprint.scenarios[0].tasking.escalation.label, "Peacetime Patrol");
  assert.equal(blueprint.scenarios[0].tasking.rulesOfEngagement.label, "Weapons Tight");
  assert.equal(blueprint.scenarios[2].tasking.primaryTask.attackRequired, true);
  assert.match(blueprint.scenarios[2].objectiveText, /Attack authority applies only to the designated hostile unit/i);
  assert.equal(blueprint.scenarios[4].reserved, true);
});

test("continuation generation can escalate into an explicit strike mission", () => {
  const scenario = buildContinuationScenario({
    campaignId: "cont_test",
    theaterId: "south_china_sea",
    year: 2028,
    playerName: "USS Test",
    missionIndex: 2,
    slotNumber: 3,
    referenceIso: "2028-03-15T00:00:00Z",
    objective: "intercept_route",
    riskPosture: "aggressive",
    operationalTempo: "immediate",
    priorMissionCount: 3,
    lastOutcome: "success",
    missionStance: "aggressive_intercept",
    campaignClimate: "breakout_hunt",
    currentEscalation: "heightened_tension"
  });

  assert.equal(scenario.escalationKey, "open_warfare");
  assert.equal(scenario.roeKey, "hostile_flagged_free_fire");
  assert.equal(scenario.tasking.primaryTask.attackRequired, true);
  assert.match(scenario.tasking.primaryTask.objectiveLine, /attack it/i);
});

test("generated mission briefing spells out ROE and designated target", () => {
  const blueprint = buildCampaignBlueprint({
    title: "Brief Test",
    campaignId: "brief_test",
    theater: "south_china_sea",
    campaignClimate: "breakout_hunt",
    missionStance: "aggressive_intercept",
    rulesOfEngagement: "designated_targets_only",
    scenarioCount: 4,
    playerName: "USS Test"
  });
  const strikeScenario = blueprint.scenarios[2];
  const artifacts = buildScenarioPackageArtifacts({ blueprint, scenario: strikeScenario });
  const metadataPath = Object.keys(artifacts.files).find((key) => key.endsWith(`${strikeScenario.slug}.mis.json`));
  const metadata = JSON.parse(artifacts.files[metadataPath]);
  const briefing = decodeBase64Field(metadata.messages.mission_objectives);

  assert.match(briefing, /Rules Of Engagement:/);
  assert.match(briefing, /Designated Target:/);
  assert.match(briefing, /End State:/);
});

test("mission script maps peacetime weapons-tight state to safe stock enums", () => {
  const blueprint = buildCampaignBlueprint({
    title: "Script Map 1",
    campaignId: "script_map_1",
    theater: "luzon_strait",
    campaignClimate: "surveillance",
    missionType: "asuw_military",
    missionStance: "wide_area_search",
    rulesOfEngagement: "weapons_tight",
    scenarioCount: 4,
    playerName: "USS Test"
  });
  const scenario = blueprint.scenarios[0];
  const artifacts = buildScenarioPackageArtifacts({ blueprint, scenario });
  const scriptPath = Object.keys(artifacts.files).find((key) => key.endsWith(`${scenario.slug}.mis`));
  const script = artifacts.files[scriptPath];

  assert.match(script, /SetTensionLevel\(TensionLevel\.Peace\)\.SetMissionROE\(RulesOfEngagement\.Hold\)/);
});

test("mission script maps crisis and open-warfare ROE states to stock enums", () => {
  const crisisBlueprint = buildCampaignBlueprint({
    title: "Script Map 2",
    campaignId: "script_map_2",
    theater: "luzon_strait",
    campaignClimate: "surveillance",
    missionType: "asuw_military",
    missionStance: "wide_area_search",
    scenarioCount: 4,
    playerName: "USS Test"
  });
  const crisisScenario = crisisBlueprint.scenarios[2];
  const crisisArtifacts = buildScenarioPackageArtifacts({ blueprint: crisisBlueprint, scenario: crisisScenario });
  const crisisScriptPath = Object.keys(crisisArtifacts.files).find((key) => key.endsWith(`${crisisScenario.slug}.mis`));
  const crisisScript = crisisArtifacts.files[crisisScriptPath];
  assert.match(crisisScript, /SetTensionLevel\(TensionLevel\.Increased\)\.SetMissionROE\(RulesOfEngagement\.Tight\)/);

  const warScenario = buildContinuationScenario({
    campaignId: "script_map_3",
    theaterId: "south_china_sea",
    year: 2028,
    playerName: "USS Test",
    missionIndex: 2,
    slotNumber: 3,
    referenceIso: "2028-03-15T00:00:00Z",
    objective: "intercept_route",
    riskPosture: "aggressive",
    operationalTempo: "immediate",
    priorMissionCount: 3,
    lastOutcome: "success",
    missionStance: "aggressive_intercept",
    missionType: "asw",
    campaignClimate: "breakout_hunt",
    currentEscalation: "heightened_tension"
  });
  const warBlueprint = {
    campaignId: "script_map_3",
    theaterId: "south_china_sea",
    family: "sub_hunt",
    player: { name: "USS Test" },
    missionTypeLabel: "ASW"
  };
  const warArtifacts = buildScenarioPackageArtifacts({ blueprint: warBlueprint, scenario: warScenario });
  const warScriptPath = Object.keys(warArtifacts.files).find((key) => key.endsWith(`${warScenario.slug}.mis`));
  const warScript = warArtifacts.files[warScriptPath];
  assert.match(warScript, /SetTensionLevel\(TensionLevel\.War\)\.SetMissionROE\(RulesOfEngagement\.Free\)/);
});

test("mission type fallback is explicit when the requested type is unsupported", () => {
  const blueprint = buildCampaignBlueprint({
    title: "Fallback Test",
    campaignId: "fallback_test",
    theater: "luzon_strait",
    missionType: "land_attack"
  });

  assert.equal(blueprint.requestedMissionType, "land_attack");
  assert.equal(blueprint.missionType, "asuw_military");
  assert.match(blueprint.warnings[0], /experimental and currently disabled/i);
});

test("experimental mission families stay gated when the toggle is off", () => {
  const blueprint = buildCampaignBlueprint({
    title: "Experimental Off",
    campaignId: "experimental_off",
    theater: "luzon_strait",
    missionType: "spec_ops"
  });

  assert.equal(blueprint.requestedMissionType, "spec_ops");
  assert.equal(blueprint.missionType, "asuw_military");
  assert.equal(blueprint.experimentalFeatures.enabled, false);
  assert.match(blueprint.warnings[0], /experimental and currently disabled/i);
});

test("experimental plot seeds and mission families can be enabled without changing the stable default path", () => {
  const blueprint = buildCampaignBlueprint({
    title: "Experimental On",
    campaignId: "experimental_on",
    theater: "luzon_strait",
    missionType: "counter_piracy",
    missionStance: "wide_area_search",
    rulesOfEngagement: "designated_targets_only",
    experimentalFeatures: {
      enabled: true,
      plotSeed: "grey_zone_smuggling_crackdown"
    }
  });

  assert.equal(blueprint.missionType, "counter_piracy");
  assert.equal(blueprint.experimentalFeatures.enabled, true);
  assert.equal(blueprint.experimentalFeatures.plotSeed, "grey_zone_smuggling_crackdown");
  assert.match(blueprint.warnings[0], /experimental/i);
  assert.match(blueprint.scenarios[0].summary, /grey-zone logistics network/i);
  assert.match(blueprint.scenarios[0].objectiveText, /actionable attribution/i);
});

test("land attack remains a gated placeholder even when experimental content is enabled", () => {
  const blueprint = buildCampaignBlueprint({
    title: "Land Attack Gate",
    campaignId: "land_attack_gate",
    theater: "luzon_strait",
    missionType: "land_attack",
    experimentalFeatures: {
      enabled: true,
      plotSeed: "littoral_special_recon"
    }
  });

  assert.equal(blueprint.requestedMissionType, "land_attack");
  assert.equal(blueprint.missionType, "asuw_military");
  assert.match(blueprint.warnings[0], /not technically supported/i);
});

test("scenario count now means playable scenarios and always appends one reserved tail slot", () => {
  const singleBlueprint = buildCampaignBlueprint({
    title: "Single Mission",
    campaignId: "single_mission",
    theater: "norwegian_sea",
    scenarioCount: 1
  });
  assert.equal(singleBlueprint.scenarioCount, 1);
  assert.equal(singleBlueprint.totalScenarioCount, 2);
  assert.equal(singleBlueprint.scenarios.length, 2);
  assert.equal(singleBlueprint.scenarios[0].reserved, false);
  assert.equal(singleBlueprint.scenarios[1].reserved, true);

  const doubleBlueprint = buildCampaignBlueprint({
    title: "Double Mission",
    campaignId: "double_mission",
    theater: "norwegian_sea",
    scenarioCount: 2
  });
  assert.equal(doubleBlueprint.scenarioCount, 2);
  assert.equal(doubleBlueprint.totalScenarioCount, 3);
  assert.equal(doubleBlueprint.scenarios.length, 3);
  assert.equal(doubleBlueprint.scenarios[0].reserved, false);
  assert.equal(doubleBlueprint.scenarios[1].reserved, false);
  assert.equal(doubleBlueprint.scenarios[2].reserved, true);
});

test("campaign seed controls deterministic variety independently from campaign id", () => {
  const sharedSpec = {
    title: "Seed Control",
    campaignId: "shared_campaign_identity",
    theater: "norwegian_sea",
    campaignClimate: "breakout_hunt",
    missionType: "asw",
    scenarioCount: 1,
    playerName: "USS Test"
  };
  const alphaA = buildCampaignBlueprint({
    ...sharedSpec,
    campaignSeed: "alpha_seed"
  });
  const alphaB = buildCampaignBlueprint({
    ...sharedSpec,
    campaignSeed: "alpha_seed"
  });
  const bravo = buildCampaignBlueprint({
    ...sharedSpec,
    campaignSeed: "bravo_seed"
  });

  assert.equal(alphaA.seed, alphaB.seed);
  assert.deepEqual(alphaA.scenarios[0].geometry.routeSummary, alphaB.scenarios[0].geometry.routeSummary);
  assert.equal(alphaA.scenarios[0].intel.likelyBearing, alphaB.scenarios[0].intel.likelyBearing);
  assert.ok(
    alphaA.seed !== bravo.seed
      || alphaA.scenarios[0].intel.likelyBearing !== bravo.scenarios[0].intel.likelyBearing
      || alphaA.scenarios[0].geometry.routeVariantLabel !== bravo.scenarios[0].geometry.routeVariantLabel
      || alphaA.scenarios[0].variation.key !== bravo.scenarios[0].variation.key,
    "expected a different campaign seed to alter the deterministic opening package"
  );
});

test("first breakout-hunt mission now produces materially different opening packages across fresh campaigns", () => {
  const samples = Array.from({ length: 10 }, (_, index) => buildCampaignBlueprint({
    title: `Opening Variety ${index + 1}`,
    campaignId: `opening_variety_${index + 1}`,
    theater: "norwegian_sea",
    campaignClimate: "breakout_hunt",
    missionType: "asw",
    scenarioCount: 1,
    playerName: "USS Test"
  }).scenarios[0]);

  const geometryProfiles = new Set(samples.map((scenario) => scenario.geometry.openingProfile).filter(Boolean));
  const forceProfiles = new Set(samples.map((scenario) => scenario.forces.openingProfile).filter(Boolean));
  const routeVariants = new Set(samples.map((scenario) => scenario.geometry.routeVariantLabel));
  const likelyBearings = new Set(samples.map((scenario) => scenario.intel.likelyBearing));
  const enemyPrimarySignatures = new Set(samples.map((scenario) => scenario.forces.enemyPrimary.map((unit) => unit.name).sort().join(" | ")));

  assert.ok(geometryProfiles.size >= 3, `expected at least 3 opening geometry profiles, got ${geometryProfiles.size}`);
  assert.ok(forceProfiles.size >= 3, `expected at least 3 opening force profiles, got ${forceProfiles.size}`);
  assert.ok(routeVariants.size >= 3, `expected at least 3 route variants, got ${routeVariants.size}`);
  assert.ok(likelyBearings.size >= 3, `expected at least 3 likely bearings, got ${likelyBearings.size}`);
  assert.ok(!samples.some((scenario) => scenario.intel.likelyBearing === "north-east"), "expected first breakout-hunt openings to avoid the legacy north-east lane");
  assert.ok(enemyPrimarySignatures.size >= 4, `expected at least 4 enemy opening signatures, got ${enemyPrimarySignatures.size}`);
  assert.ok(samples.some((scenario) => scenario.forces.enemyPrimary.length === 1), "expected at least one opening with a lone primary submarine");
  assert.ok(samples.some((scenario) => scenario.forces.enemyPrimary.length >= 3), "expected at least one opening with a heavier screened submarine package");
});

test("sub-hunt support groups anchor to a defined plot", () => {
  const blueprint = buildCampaignBlueprint({
    title: "Support Anchor",
    campaignId: "support_anchor",
    theater: "norwegian_sea",
    missionType: "asw",
    scenarioCount: 1,
    playerName: "USS Test"
  });
  const scenario = {
    ...blueprint.scenarios[0],
    forces: {
      ...blueprint.scenarios[0].forces,
      enemySurfaceSupport: [
        { name: "Support DDG", dbid: 3883, faction: "RU" }
      ],
      enemyAir: [
        { name: "Support Helo", dbid: 60, faction: "RU" }
      ]
    }
  };
  const artifacts = buildScenarioPackageArtifacts({ blueprint, scenario });
  const scriptPath = Object.keys(artifacts.files).find((key) => key.endsWith(`${scenario.slug}.mis`));
  const script = artifacts.files[scriptPath];

  assert.match(script, /support_plot_anchor = escort_plot/);
  assert.doesNotMatch(script, /support_plot_anchor = russian_plot/);
  assert.match(script, /support_surface_0_spawn = _P\.Element\.Spawn\(support_plot_anchor,/);
});

test("deterministic mission variations can change task emphasis and force bias", () => {
  const blueprint = buildCampaignBlueprint({
    title: "Variation Test",
    campaignId: "variation_test",
    theater: "luzon_strait",
    campaignClimate: "surveillance",
    missionType: "asuw_military",
    missionStance: "wide_area_search",
    rulesOfEngagement: "weapons_tight",
    scenarioCount: 4,
    playerName: "USS Test"
  });

  const variationKeys = blueprint.scenarios.slice(0, 4).map((scenario) => scenario.variation.key);
  const taskKeys = blueprint.scenarios.slice(0, 4).map((scenario) => scenario.tasking.primaryTask.key);

  assert.equal(variationKeys.every((key) => key !== "standard"), true);
  assert.equal(taskKeys.includes("designated_strike"), true);
  assert.equal(taskKeys.includes("break_contact_escape"), true);
  assert.equal(taskKeys.some((key) => key === "classify_screen" || key === "confirm_route" || key === "trail_handoff"), true);
  assert.equal(blueprint.scenarios[2].tasking.primaryTask.key, "designated_strike");
  assert.equal(blueprint.scenarios[2].forces.enemyAir.length >= 1, true);
});

test("continuation generation carries deterministic variation metadata", () => {
  const scenario = buildContinuationScenario({
    campaignId: "cont_variation",
    theaterId: "south_china_sea",
    year: 2028,
    playerName: "USS Test",
    missionIndex: 2,
    slotNumber: 3,
    referenceIso: "2028-03-15T00:00:00Z",
    objective: "intercept_route",
    riskPosture: "aggressive",
    operationalTempo: "immediate",
    priorMissionCount: 3,
    lastOutcome: "success",
    missionStance: "aggressive_intercept",
    campaignClimate: "breakout_hunt",
    currentEscalation: "heightened_tension"
  });

  assert.equal(scenario.variation.key, "turnpoint_ambush");
  assert.equal(scenario.variation.forceBias.enemySurfaceSupport, 1);
  assert.match(scenario.summary, /turn point/i);
});

test("player submarine selection persists into blueprint metadata and mission scripts", () => {
  const blueprint = buildCampaignBlueprint({
    title: "Player Sub Test",
    campaignId: "player_sub_test",
    theater: "norwegian_sea",
    missionType: "asw",
    playerSubmarine: "virginia_block_ii",
    playerName: "USS Test"
  });

  assert.equal(blueprint.playerSubmarine, "virginia_block_ii");
  assert.equal(blueprint.player.platformShortLabel, "Virginia B2");
  assert.match(blueprint.warnings.join(" "), /Block III MNW database entry as a fallback/i);

  const scenario = blueprint.scenarios[0];
  const artifacts = buildScenarioPackageArtifacts({ blueprint, scenario });
  const scriptPath = Object.keys(artifacts.files).find((key) => key.endsWith(`${scenario.slug}.mis`));
  const script = artifacts.files[scriptPath];

  assert.match(script, /\(Player\) Virginia B2/);
  assert.match(script, /virginia_id = 1015/);
});

test("season and time-of-day controls affect scenario clocks and briefing text", () => {
  const blueprint = buildCampaignBlueprint({
    title: "Temporal Test",
    campaignId: "temporal_test",
    theater: "south_china_sea",
    missionType: "asw",
    season: "summer",
    timeOfDay: "dusk",
    playerName: "USS Test"
  });

  assert.equal(blueprint.season, "summer");
  assert.equal(blueprint.timeOfDay, "dusk");
  assert.equal(blueprint.scenarios[0].startMnw, "2028/07/18 18:35:00");
  assert.equal(blueprint.scenarios[0].temporalContext.label, "Summer, Dusk");

  const artifacts = buildScenarioPackageArtifacts({ blueprint, scenario: blueprint.scenarios[0] });
  const metadataPath = Object.keys(artifacts.files).find((key) => key.endsWith(`${blueprint.scenarios[0].slug}.mis.json`));
  const metadata = JSON.parse(artifacts.files[metadataPath]);
  const briefing = decodeBase64Field(metadata.messages.mission_objectives);

  assert.match(briefing, /Scenario Time:/);
  assert.match(briefing, /Summer, Dusk/);

  const continuation = buildContinuationScenario({
    campaignId: "temporal_continue",
    theaterId: "south_china_sea",
    year: 2028,
    playerName: "USS Test",
    missionIndex: 1,
    slotNumber: 2,
    referenceIso: "2028-07-18T18:35:00Z",
    objective: "pursue_contact",
    season: "summer",
    timeOfDay: "night"
  });
  assert.match(continuation.startMnw, /02:10:00$/);
  assert.equal(continuation.temporalContext.label, "Summer, Night");
});

test("surveillance snapshot remains stable", async () => {
  const expected = JSON.parse(await fs.readFile(new URL("./fixtures/surveillance_snapshot.json", import.meta.url), "utf8"));
  const blueprint = buildCampaignBlueprint({
    title: "Snap",
    campaignId: "snap",
    theater: "luzon_strait",
    campaignClimate: "surveillance",
    missionType: "asuw_military",
    missionStance: "wide_area_search",
    rulesOfEngagement: "weapons_tight",
    scenarioCount: 4,
    playerName: "USS Test"
  });
  const scenario = blueprint.scenarios[0];
  const actual = {
    summary: scenario.summary,
    objective: scenario.objectiveText,
    success: scenario.successText,
    missionType: blueprint.missionType
  };
  assert.deepEqual(actual, expected);
});

test("strike snapshot remains stable", async () => {
  const expected = JSON.parse(await fs.readFile(new URL("./fixtures/strike_snapshot.json", import.meta.url), "utf8"));
  const blueprint = buildCampaignBlueprint({
    title: "Snap2",
    campaignId: "snap2",
    theater: "south_china_sea",
    campaignClimate: "breakout_hunt",
    missionType: "asw",
    missionStance: "aggressive_intercept",
    rulesOfEngagement: "military_targets_of_opportunity",
    scenarioCount: 4,
    playerName: "USS Test"
  });
  const scenario = blueprint.scenarios[2];
  const actual = {
    summary: scenario.summary,
    objective: scenario.objectiveText,
    success: scenario.successText,
    missionType: blueprint.missionType
  };
  assert.deepEqual(actual, expected);
});
