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
  assert.equal(blueprint.scenarios[0].tasking.escalation.label, "Peacetime Patrol");
  assert.equal(blueprint.scenarios[0].tasking.rulesOfEngagement.label, "Weapons Tight");
  assert.equal(blueprint.scenarios[2].tasking.primaryTask.attackRequired, true);
  assert.match(blueprint.scenarios[2].objectiveText, /Attack authority applies only to the designated hostile unit/i);
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
