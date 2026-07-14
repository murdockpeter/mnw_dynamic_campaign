import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { loadSettings } from "../portable/lib/settings-store.mjs";
import { buildCampaignBlueprint, getTheaterTemplates } from "../shared/campaign-generator.mjs";

function parseArgs(argv) {
  const args = {
    runs: 20,
    settingsPath: path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "mnw-dynamic-campaign", "settings.json"),
    output: path.join(process.cwd(), "generated", "reports", "current-start-variance.json")
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--runs" && next) {
      args.runs = Math.max(1, Number(next) || 20);
      index += 1;
    } else if (token === "--settings" && next) {
      args.settingsPath = next;
      index += 1;
    } else if ((token === "--campaign-id" || token === "--campaign-seed") && next) {
      args.campaignSeed = next;
      index += 1;
    } else if (token === "--output" && next) {
      args.output = next;
      index += 1;
    }
  }

  return args;
}

function theaterIdFromLabel(value) {
  const entry = Object.values(getTheaterTemplates()).find((theater) => (
    theater.id === value || theater.label === value || theater.theaterName === value
  ));
  return entry?.id || "norwegian_sea";
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

async function resolveSavedStartSpec(settingsPath, overrideCampaignSeed = "") {
  const settings = await loadSettings(settingsPath);
  const preferredCampaignId = settings.preferredCampaignId || "silent_meridian";
  const preferredCampaignSeed = overrideCampaignSeed || preferredCampaignId;
  const workspaceRoot = path.join(path.dirname(settingsPath), "workspace");
  const campaignPath = path.join(workspaceRoot, "campaigns", preferredCampaignId, "campaign.json");
  const statePath = path.join(workspaceRoot, "state", preferredCampaignId, "campaign_state.json");

  const campaign = await readJson(campaignPath);
  let playerName = "";
  try {
    const state = await readJson(statePath);
    const playerUnit = Object.values(state.order_of_battle || {}).find((unit) => Array.isArray(unit.tags) && unit.tags.includes("player"));
    playerName = playerUnit?.name || "";
  } catch {
    playerName = "";
  }

  return {
    title: campaign.title || preferredCampaignId,
    campaignId: campaign.campaign_id || preferredCampaignId,
    campaignSeed: campaign.campaign_seed || campaign.campaign_id || preferredCampaignSeed,
    theater: theaterIdFromLabel(campaign.theater),
    campaignClimate: campaign.campaign_climate || "surveillance",
    missionType: campaign.mission_type || "asw",
    season: campaign.season || "theater_default",
    timeOfDay: campaign.time_of_day || "theater_default",
    playerSubmarine: campaign.player_submarine || "virginia_block_iii",
    missionStance: campaign.mission_stance || "wide_area_search",
    rulesOfEngagement: campaign.rules_of_engagement || "weapons_tight",
    scenarioCount: 1,
    playerName: playerName || "USS Test"
  };
}

function summarizeScenario(scenario) {
  return {
    missionId: scenario.missionId,
    route: scenario.geometry.routeVariantLabel,
    routeAspect: scenario.geometry.routeAspect?.label || null,
    geometryProfile: scenario.geometry.openingProfile || null,
    forceProfile: scenario.forces.openingProfile || null,
    bearing: scenario.intel.likelyBearing,
    task: scenario.tasking.primaryTask.key,
    variation: scenario.variation.key,
    primary: scenario.forces.enemyPrimary.map((unit) => unit.name),
    enemySurfaceSupport: scenario.forces.enemySurfaceSupport.map((unit) => unit.name),
    enemyAir: scenario.forces.enemyAir.map((unit) => unit.name),
    friendlySurface: scenario.forces.friendlySurface.map((unit) => unit.name),
    friendlyAir: scenario.forces.friendlyAir.map((unit) => unit.name),
    summary: scenario.summary
  };
}

function countUnique(values) {
  return new Set(values).size;
}

function summarizeVariance(runs) {
  return {
    routes: countUnique(runs.map((run) => run.route)),
    routeAspects: countUnique(runs.map((run) => run.routeAspect)),
    bearings: countUnique(runs.map((run) => run.bearing)),
    variations: countUnique(runs.map((run) => run.variation)),
    enemyPrimary: countUnique(runs.map((run) => run.primary.join(" | "))),
    geometryProfiles: countUnique(runs.map((run) => run.geometryProfile)),
    forceProfiles: countUnique(runs.map((run) => run.forceProfile)),
    tasks: countUnique(runs.map((run) => run.task))
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const base = await resolveSavedStartSpec(args.settingsPath, args.campaignSeed);
  const sameSpecRuns = Array.from({ length: args.runs }, () => summarizeScenario(buildCampaignBlueprint(base).scenarios[0]));
  const variedSeedRuns = Array.from({ length: args.runs }, (_, index) => summarizeScenario(buildCampaignBlueprint({
    ...base,
    title: `${base.title} Variance ${index + 1}`,
    campaignSeed: `${base.campaignSeed}_variance_${String(index + 1).padStart(2, "0")}`,
    campaignId: base.campaignId
  }).scenarios[0]));

  const report = {
    generatedAt: new Date().toISOString(),
    settingsPath: args.settingsPath,
    base,
    sameSpecRuns,
    variedSeedRuns,
    variedIdRuns: variedSeedRuns,
    sameSpecUnique: summarizeVariance(sameSpecRuns),
    variedSeedUnique: summarizeVariance(variedSeedRuns),
    variedIdUnique: summarizeVariance(variedSeedRuns)
  };

  await fs.mkdir(path.dirname(args.output), { recursive: true });
  await fs.writeFile(args.output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    output: args.output,
    base,
    sameSpecUnique: report.sameSpecUnique,
    variedSeedUnique: report.variedSeedUnique
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
