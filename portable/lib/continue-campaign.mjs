import fs from "node:fs/promises";
import path from "node:path";

import {
  buildContinuationScenario,
  findTheaterTemplateByName
} from "../../shared/campaign-generator.mjs";
import { buildQuestScript, buildScenarioPackageArtifacts } from "./generated-campaign-files.mjs";
import { ensureDir, readJson, writeText } from "./fs-helpers.mjs";
import { exportRuntimePayload, loadLatestResult, loadOrBootstrapState, readMissionChain } from "./runtime.mjs";
import { writeJsonSafely } from "./safe-write.mjs";

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

function upsertScenarioLocaleRows(existingCsv, campaignId, scenarioSlug, rows) {
  const missionPrefix = `${campaignId}/${scenarioSlug}.mis,`;
  const preservedLines = String(existingCsv || "")
    .split(/\r?\n/g)
    .filter((line) => line && !line.startsWith(missionPrefix));
  return appendCsvRows(preservedLines.join("\n"), rows);
}

function missionSlugFromId(missionId) {
  return String(missionId || "").split(".").pop() || null;
}

function resolveContinuationSlot(state, missionChain, campaignId) {
  const missionHistory = Array.isArray(state.mission_history) ? state.mission_history : [];
  const latestCompletedMission = missionHistory[missionHistory.length - 1] || null;
  if (!latestCompletedMission?.mission_id) {
    throw new Error(`No saved mission result is available to continue ${campaignId}. Save the completed mission result first.`);
  }

  const completedSlotIndex = missionChain.indexOf(latestCompletedMission.mission_id);
  if (completedSlotIndex < 0) {
    throw new Error(`The latest completed mission ${latestCompletedMission.mission_id} is not present in the campaign chain for ${campaignId}.`);
  }

  const targetSlotIndex = completedSlotIndex + 1;
  const targetMissionId = missionChain[targetSlotIndex] || null;
  if (!targetMissionId) {
    throw new Error(`No reserved mission slot follows ${latestCompletedMission.mission_id} in ${campaignId}. Rebuild the campaign package before continuing.`);
  }

  return {
    latestCompletedMission,
    targetMissionId,
    targetSlotIndex
  };
}

function theaterPictureWithPersistentForceState(state) {
  const picture = structuredClone(state.world_state?.theater_picture || {});
  picture.units = picture.units || {};
  for (const unit of Object.values(state.order_of_battle || {})) {
    const track = picture.units[unit.unit_id] || {};
    const nextTrack = {
      ...track,
      unit_id: unit.unit_id,
      fatigue: Number(track.fatigue || 0),
      sorties: Number(track.sorties || 0),
      recovery_hours_remaining: Number(track.recovery_hours_remaining || 0)
    };
    if (unit.destroyed) {
      Object.assign(nextTrack, {
        operational_state: "destroyed",
        availability: "destroyed",
        on_stage: false,
        recovery_hours_remaining: 0
      });
    } else if (Number(unit.damage || 0) >= 0.25) {
      Object.assign(nextTrack, {
        operational_state: "repairing",
        availability: "unavailable",
        on_stage: false,
        recovery_hours_remaining: Math.max(nextTrack.recovery_hours_remaining, Math.ceil(Number(unit.damage || 0) * 120))
      });
    }
    picture.units[unit.unit_id] = {
      ...(picture.units[unit.unit_id] || {}),
      ...nextTrack
    };
  }
  return picture;
}

export async function appendContinuationScenario({
  repoRoot,
  campaignId,
  objective,
  riskPosture,
  operationalTempo,
  stateDir,
  aisSnapshot = null
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
  const {
    latestCompletedMission,
    targetMissionId: currentMissionId,
    targetSlotIndex: currentSlotIndex
  } = resolveContinuationSlot(state, missionChain, campaignId);
  const hasTailSlot = currentSlotIndex < missionChain.length - 1;
  const currentSlotSlug = missionSlugFromId(currentMissionId);

  const scenario = buildContinuationScenario({
    campaignId,
    campaignSeed: state.world_state?.campaign_seed || campaignConfig.campaign_seed || campaignId,
    theaterId: theater.id,
    year: new Date(state.campaign_clock || Date.now()).getUTCFullYear(),
    playerName: playerUnit.name,
    playerSubmarine: state.world_state?.player_submarine || campaignConfig.player_submarine || playerUnit.notes?.player_submarine_key || "virginia_block_iii",
    missionIndex: currentSlotIndex,
    slotNumber: currentSlotIndex + 1,
    slugOverride: currentSlotSlug,
    referenceIso: state.campaign_clock || new Date().toISOString(),
    objective,
    riskPosture,
    operationalTempo,
    priorMissionCount: currentSlotIndex + 1,
    lastOutcome: latestCompletedMission.outcome || latestResult?.outcome || "success",
    theaterPicture: theaterPictureWithPersistentForceState(state),
    posture: state.world_state?.posture || "wide_area_search",
    missionStance: state.world_state?.mission_stance || state.world_state?.posture || "wide_area_search",
    missionType: state.world_state?.mission_type || campaignConfig.mission_type || null,
    campaignClimate: state.world_state?.campaign_climate || campaignConfig.campaign_climate || campaignConfig.tone || "surveillance",
    season: state.world_state?.season || campaignConfig.season || "theater_default",
    timeOfDay: state.world_state?.time_of_day || campaignConfig.time_of_day || "theater_default",
    currentEscalation: state.world_state?.escalation_key || null,
    requestedRoe: state.world_state?.rules_of_engagement || campaignConfig.rules_of_engagement || null,
    authoringConstraints: state.world_state?.authoring_constraints || campaignConfig.authoring_constraints || {},
    forcePoolPolicy: state.world_state?.force_pool_policy || campaignConfig.force_pool_policy || null,
    aisSnapshot,
    experimental: state.world_state?.experimental_features || campaignConfig.experimental_features || { enabled: false, plotSeed: "none" }
  });
  const tailScenario = hasTailSlot ? null : buildContinuationScenario({
    campaignId,
    campaignSeed: state.world_state?.campaign_seed || campaignConfig.campaign_seed || campaignId,
    theaterId: theater.id,
    year: new Date(state.campaign_clock || Date.now()).getUTCFullYear(),
    playerName: playerUnit.name,
    playerSubmarine: state.world_state?.player_submarine || campaignConfig.player_submarine || playerUnit.notes?.player_submarine_key || "virginia_block_iii",
    missionIndex: currentSlotIndex + 1,
    slotNumber: currentSlotIndex + 2,
    referenceIso: scenario.startIso,
    objective: "pursue_contact",
    riskPosture: "balanced",
    operationalTempo: "deliberate",
    priorMissionCount: currentSlotIndex + 2,
    lastOutcome: "success",
    theaterPicture: scenario.theaterPicture || state.world_state?.theater_picture || null,
    posture: state.world_state?.posture || "wide_area_search",
    missionStance: state.world_state?.mission_stance || state.world_state?.posture || "wide_area_search",
    missionType: state.world_state?.mission_type || campaignConfig.mission_type || null,
    campaignClimate: state.world_state?.campaign_climate || campaignConfig.campaign_climate || campaignConfig.tone || "surveillance",
    season: state.world_state?.season || campaignConfig.season || "theater_default",
    timeOfDay: state.world_state?.time_of_day || campaignConfig.time_of_day || "theater_default",
    currentEscalation: scenario.escalationKey || state.world_state?.escalation_key || null,
    requestedRoe: scenario.roeKey || state.world_state?.rules_of_engagement || campaignConfig.rules_of_engagement || null,
    authoringConstraints: state.world_state?.authoring_constraints || campaignConfig.authoring_constraints || {},
    forcePoolPolicy: state.world_state?.force_pool_policy || campaignConfig.force_pool_policy || null,
    reserved: true,
    aisSnapshot,
    experimental: state.world_state?.experimental_features || campaignConfig.experimental_features || { enabled: false, plotSeed: "none" }
  });

  const blueprint = {
    campaignId,
    theaterId: theater.id,
    family: theater.family,
    player: {
      name: playerUnit.name,
      dbid: playerUnit.dbid,
      variantKey: state.world_state?.player_submarine || campaignConfig.player_submarine || playerUnit.notes?.player_submarine_key || "virginia_block_iii",
      platformLabel: state.world_state?.player_submarine_label || campaignConfig.player_submarine_label || playerUnit.notes?.player_submarine_label || "Virginia Block III",
      platformShortLabel: playerUnit.notes?.player_submarine_short_label || "Virginia B3",
      platformDbid: state.world_state?.player_submarine_platform_dbid || campaignConfig.player_submarine_platform_dbid || playerUnit.notes?.player_submarine_platform_dbid || null,
      verifiedDb: state.world_state?.player_submarine_verified_db ?? campaignConfig.player_submarine_verified_db ?? playerUnit.notes?.player_submarine_verified_db ?? true
    }
  };
  const artifacts = buildScenarioPackageArtifacts({ blueprint, scenario });
  const tailArtifacts = tailScenario ? buildScenarioPackageArtifacts({ blueprint, scenario: tailScenario }) : null;

  await ensureDir(packageDir);
  for (const [relativePath, content] of Object.entries(artifacts.files)) {
    await writeText(path.join(packageDir, relativePath), content);
  }
  if (tailArtifacts) {
    for (const [relativePath, content] of Object.entries(tailArtifacts.files)) {
      await writeText(path.join(packageDir, relativePath), content);
    }
  }

  const updatedMissionChain = [...missionChain];
  updatedMissionChain[currentSlotIndex] = scenario.missionId;
  if (tailScenario) {
    updatedMissionChain.push(tailScenario.missionId);
  }
  await writeText(path.join(packageDir, campaignId, "quest.cmp"), buildQuestScript(updatedMissionChain));

  const localePath = path.join(packageDir, "locale.csv");
  const existingLocale = await readTextIfExists(localePath);
  let nextLocale = upsertScenarioLocaleRows(existingLocale, campaignId, scenario.slug, artifacts.localeRows);
  if (tailScenario && tailArtifacts) {
    nextLocale = upsertScenarioLocaleRows(nextLocale, campaignId, tailScenario.slug, tailArtifacts.localeRows);
  }
  await writeText(localePath, nextLocale);

  state.world_state = state.world_state || {};
  state.current_mission_id = scenario.missionId;
  state.world_state.theater_picture = scenario.theaterPicture || state.world_state.theater_picture || {};
  state.world_state.posture = scenario.continuation?.posture || state.world_state.posture || "wide_area_search";
  state.world_state.mission_stance = scenario.continuation?.posture || state.world_state.mission_stance || state.world_state.posture || "wide_area_search";
  state.world_state.mission_type = scenario.continuation?.missionType || state.world_state.mission_type || campaignConfig.mission_type || null;
  state.world_state.campaign_climate = scenario.continuation?.campaignClimate || state.world_state.campaign_climate || campaignConfig.campaign_climate || campaignConfig.tone || "surveillance";
  state.world_state.campaign_seed = state.world_state.campaign_seed || campaignConfig.campaign_seed || campaignId;
  state.world_state.season = scenario.continuation?.season || state.world_state.season || campaignConfig.season || "theater_default";
  state.world_state.time_of_day = scenario.continuation?.timeOfDay || state.world_state.time_of_day || campaignConfig.time_of_day || "theater_default";
  state.world_state.player_submarine = scenario.continuation?.playerSubmarine || state.world_state.player_submarine || campaignConfig.player_submarine || "virginia_block_iii";
  state.world_state.player_submarine_label = scenario.continuation?.playerSubmarineLabel || state.world_state.player_submarine_label || campaignConfig.player_submarine_label || "Virginia Block III";
  state.world_state.player_submarine_platform_dbid = state.world_state.player_submarine_platform_dbid || campaignConfig.player_submarine_platform_dbid || playerUnit.notes?.player_submarine_platform_dbid || null;
  state.world_state.player_submarine_verified_db = state.world_state.player_submarine_verified_db ?? campaignConfig.player_submarine_verified_db ?? playerUnit.notes?.player_submarine_verified_db ?? true;
  state.world_state.escalation_key = scenario.continuation?.escalationKey || state.world_state.escalation_key || "peacetime";
  state.world_state.escalation_level = scenario.escalationLevel ?? state.world_state.escalation_level ?? 0;
  state.world_state.rules_of_engagement = scenario.continuation?.roeKey || state.world_state.rules_of_engagement || campaignConfig.rules_of_engagement || "weapons_tight";
  state.world_state.authoring_constraints = state.world_state.authoring_constraints || campaignConfig.authoring_constraints || {};
  state.world_state.force_pool_policy = scenario.forcePoolPolicy || state.world_state.force_pool_policy || campaignConfig.force_pool_policy || null;
  state.world_state.force_doctrine = scenario.forces?.doctrine || null;
  state.world_state.tactical_behavior = scenario.forces?.tacticalBehavior || null;
  state.world_state.intel_assessment = scenario.intel?.assessment || null;
  state.world_state.experimental_features = scenario.continuation?.experimentalEnabled
    ? {
      enabled: true,
      plotSeed: scenario.continuation?.plotSeed || "none",
      plotSeedLabel: scenario.continuation?.plotSeedLabel || null
    }
    : state.world_state.experimental_features || campaignConfig.experimental_features || { enabled: false, plotSeed: "none", plotSeedLabel: "None" };
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
  await writeJsonSafely(statePath, state);
  await writeJsonSafely(path.join(campaignDir, "modules.json"), modulesConfig);

  const runtime = await exportRuntimePayload({ repoRoot, campaignId, stateDir });

  return {
    campaign_id: campaignId,
    mission_id: scenario.missionId,
    mission_name: scenario.name,
    state_path: statePath,
    package_dir: packageDir,
    continuation_source_dir: packageDir,
    updated_mission_count: updatedMissionChain.length,
    next_reserved_mission_id: tailScenario?.missionId || updatedMissionChain[currentSlotIndex + 1] || null,
    continuation: scenario.continuation,
    runtime
  };
}
