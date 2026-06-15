import fs from "node:fs/promises";
import path from "node:path";

import {
  buildContinuationScenario,
  findTheaterTemplateByName
} from "../../shared/campaign-generator.mjs";
import { buildQuestScript, buildScenarioPackageArtifacts } from "./generated-campaign-files.mjs";
import { ensureDir, readJson, writeJson, writeText } from "./fs-helpers.mjs";
import { exportRuntimePayload, loadLatestResult, loadOrBootstrapState, readMissionChain } from "./runtime.mjs";

async function readTextIfExists(targetPath) {
  try {
    return await fs.readFile(targetPath, "utf8");
  } catch {
    return null;
  }
}

function findPlayerUnit(state) {
  return Object.values(state.order_of_battle || {}).find((unit) => Array.isArray(unit.tags) && unit.tags.includes("player")) || null;
}

function appendCsvRows(existingCsv, rows) {
  const current = String(existingCsv || "").trimEnd();
  const addition = rows.join("\n");
  return current ? `${current}\n${addition}\n` : `${addition}\n`;
}

export async function appendContinuationScenario({
  repoRoot,
  campaignId,
  objective,
  riskPosture,
  operationalTempo,
  stateDir
}) {
  const campaignDir = path.join(repoRoot, "campaigns", campaignId);
  const packageDir = path.join(repoRoot, "src", "packages", campaignId);
  const campaignConfig = await readJson(path.join(campaignDir, "campaign.json"));
  const modulesConfig = await readJson(path.join(campaignDir, "modules.json"));
  const theater = findTheaterTemplateByName(campaignConfig.theater);
  if (!theater) {
    throw new Error(`Unable to resolve theater template for ${campaignConfig.theater}.`);
  }

  const { state, statePath } = await loadOrBootstrapState({ repoRoot, campaignId, stateDir, campaignDir });
  const { result: latestResult } = await loadLatestResult({ repoRoot, campaignId, stateDir, campaignDir });
  const missionChain = await readMissionChain(campaignId, packageDir);
  const playerUnit = findPlayerUnit(state);
  if (!playerUnit) {
    throw new Error("Unable to resolve the player unit from campaign state.");
  }

  const missionIndex = missionChain.length;
  const scenario = buildContinuationScenario({
    campaignId,
    theaterId: theater.id,
    year: new Date(state.campaign_clock || Date.now()).getUTCFullYear(),
    playerName: playerUnit.name,
    missionIndex,
    referenceIso: state.campaign_clock || new Date().toISOString(),
    objective,
    riskPosture,
    operationalTempo,
    priorMissionCount: missionChain.length,
    lastOutcome: latestResult?.outcome || "success",
    theaterPicture: state.world_state?.theater_picture || null,
    posture: state.world_state?.posture || "wide_area_search"
  });

  const blueprint = {
    campaignId,
    theaterId: theater.id,
    family: theater.family,
    player: { name: playerUnit.name }
  };
  const artifacts = buildScenarioPackageArtifacts({ blueprint, scenario });

  await ensureDir(packageDir);
  for (const [relativePath, content] of Object.entries(artifacts.files)) {
    await writeText(path.join(packageDir, relativePath), content);
  }

  const updatedMissionChain = [...missionChain, scenario.missionId];
  await writeText(path.join(packageDir, campaignId, "quest.cmp"), buildQuestScript(updatedMissionChain));

  const localePath = path.join(packageDir, "locale.csv");
  const existingLocale = await readTextIfExists(localePath);
  await writeText(localePath, appendCsvRows(existingLocale, artifacts.localeRows));

  state.world_state = state.world_state || {};
  state.world_state.theater_picture = scenario.theaterPicture || state.world_state.theater_picture || {};
  state.world_state.posture = scenario.continuation?.posture || state.world_state.posture || "wide_area_search";
  state.world_state.continuation_count = Number(state.world_state.continuation_count || 0) + 1;
  state.world_state.last_extension_choice = {
    objective,
    riskPosture,
    operationalTempo,
    mission_id: scenario.missionId
  };
  state.world_state.extension_history = [
    ...(Array.isArray(state.world_state.extension_history) ? state.world_state.extension_history : []),
    {
      objective,
      riskPosture,
      operationalTempo,
      mission_id: scenario.missionId,
      created_at: new Date().toISOString()
    }
  ];
  await writeJson(statePath, state);
  await writeJson(path.join(campaignDir, "modules.json"), modulesConfig);

  const runtime = await exportRuntimePayload({ repoRoot, campaignId, stateDir });

  return {
    campaign_id: campaignId,
    mission_id: scenario.missionId,
    mission_name: scenario.name,
    state_path: statePath,
    package_dir: packageDir,
    continuation_source_dir: packageDir,
    updated_mission_count: updatedMissionChain.length,
    continuation: scenario.continuation,
    runtime
  };
}
