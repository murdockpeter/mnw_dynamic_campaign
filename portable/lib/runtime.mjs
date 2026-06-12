import fs from "node:fs/promises";
import path from "node:path";

import { readJson, writeJson } from "./fs-helpers.mjs";

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function initializeModules(state, modulesConfig) {
  state.enabled_modules = [...modulesConfig.enabled_modules];
  const moduleConfig = modulesConfig.module_config || {};
  state.module_state = state.module_state || {};

  if (state.enabled_modules.includes("damage")) {
    state.module_state.damage = state.module_state.damage || {};
    state.module_state.damage.repair_rate_per_day = moduleConfig.damage?.repair_rate_per_day ?? state.module_state.damage.repair_rate_per_day ?? 0.08;
  }

  if (state.enabled_modules.includes("ammo")) {
    state.module_state.ammo = state.module_state.ammo || {};
  }

  return state;
}

function ingestResult(state, result, modulesConfig) {
  const allowNegative = Boolean(modulesConfig.module_config?.ammo?.allow_negative);
  const repairRate = Number(modulesConfig.module_config?.damage?.repair_rate_per_day ?? 0.08);

  for (const event of result.events || []) {
    if (!event.unit_id || !state.order_of_battle[event.unit_id]) {
      continue;
    }

    const unit = state.order_of_battle[event.unit_id];
    if (event.event_type === "weapon_expended" && event.weapon_key) {
      const current = Number(unit.ammo?.[event.weapon_key] ?? 0);
      const nextValue = current - Number(event.amount || 0);
      unit.ammo[event.weapon_key] = allowNegative ? nextValue : Math.max(0, nextValue);
    }

    if (event.event_type === "unit_damaged") {
      const damage = Math.max(0, Math.min(1, Number(unit.damage || 0) + Number(event.amount || 0)));
      unit.damage = damage;
      unit.readiness = Math.max(0, 1 - damage);
    }

    if (event.event_type === "unit_destroyed") {
      unit.destroyed = true;
      unit.damage = 1.0;
      unit.readiness = 0.0;
    }
  }

  state.mission_history = state.mission_history || [];
  state.mission_history.push({
    mission_id: result.mission_id,
    outcome: result.outcome,
    time_elapsed_hours: result.time_elapsed_hours || 0,
    event_count: (result.events || []).length,
    notes: { ...(result.metadata || {}) }
  });

  state.module_state.damage = state.module_state.damage || {};
  state.module_state.damage.repair_rate_per_day = repairRate;

  return state;
}

function advanceTime(state, hours, modulesConfig) {
  const repairRate = Number(modulesConfig.module_config?.damage?.repair_rate_per_day ?? 0.08);
  const repairDelta = repairRate * (Number(hours || 0) / 24.0);
  for (const unit of Object.values(state.order_of_battle || {})) {
    if (unit.destroyed || Number(unit.damage || 0) <= 0) {
      continue;
    }
    unit.damage = Math.max(0, Number(unit.damage || 0) - repairDelta);
    unit.readiness = Math.max(0, 1 - unit.damage);
  }
  return state;
}

async function readMissionChain(campaignId, packageDir) {
  const questPath = path.join(packageDir, campaignId, "quest.cmp");
  try {
    const raw = await fs.readFile(questPath, "utf8");
    const matches = [...raw.matchAll(/(?:Mis|PipeMission)\("([^"]+)"\)/g)];
    return matches.map((match) => match[1]);
  } catch {
    return [];
  }
}

function buildGenerationPlan(state, nextMissionId) {
  const directives = [];
  for (const unit of Object.values(state.order_of_battle || {})) {
    if (unit.destroyed) {
      directives.push({
        source_module: "damage",
        directive_type: "exclude_unit",
        payload: { unit_id: unit.unit_id, reason: "destroyed" }
      });
      continue;
    }
    if (Number(unit.damage || 0) > 0) {
      directives.push({
        source_module: "damage",
        directive_type: "adjust_unit_damage",
        payload: {
          unit_id: unit.unit_id,
          damage: unit.damage,
          readiness: unit.readiness
        }
      });
    }
    if (unit.ammo && Object.keys(unit.ammo).length) {
      directives.push({
        source_module: "ammo",
        directive_type: "override_unit_ammo",
        payload: {
          unit_id: unit.unit_id,
          ammo: { ...unit.ammo }
        }
      });
    }
  }

  return {
    mission_id: nextMissionId || state.current_mission_id || null,
    directives
  };
}

export async function loadOrBootstrapState({ repoRoot, campaignId, stateDir, campaignDir }) {
  const effectiveStateDir = stateDir || path.join(repoRoot, "state");
  const statePath = path.join(effectiveStateDir, campaignId, "campaign_state.json");

  try {
    return {
      state: await readJson(statePath),
      statePath
    };
  } catch {
    const bootstrap = await readJson(path.join(campaignDir, "bootstrap_state.json"));
    await writeJson(statePath, bootstrap);
    return { state: bootstrap, statePath };
  }
}

export async function loadLatestResult({ repoRoot, campaignId, stateDir, campaignDir }) {
  const effectiveStateDir = stateDir || path.join(repoRoot, "state");
  const resultPath = path.join(effectiveStateDir, campaignId, "mission_results.json");

  try {
    const results = await readJson(resultPath);
    if (Array.isArray(results) && results.length) {
      return { result: results[results.length - 1], resultPath };
    }
  } catch {
    // Fall through to bootstrap result.
  }

  return {
    result: await readJson(path.join(campaignDir, "bootstrap_result.json")),
    resultPath
  };
}

export async function exportRuntimePayload({ repoRoot, campaignId, stateDir }) {
  const campaignRoot = path.join(repoRoot, "campaigns");
  const availableCampaignIds = await fs.readdir(campaignRoot, { withFileTypes: true })
    .then((entries) => entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name))
    .catch(() => []);
  const effectiveCampaignId = availableCampaignIds.includes(campaignId)
    ? campaignId
    : (availableCampaignIds.includes("silent_meridian") ? "silent_meridian" : availableCampaignIds[0]);
  if (!effectiveCampaignId) {
    throw new Error(`No campaigns available under ${campaignRoot}`);
  }

  const campaignDir = path.join(repoRoot, "campaigns", effectiveCampaignId);
  let packageDir = path.join(repoRoot, "src", "packages", effectiveCampaignId);
  if (!(await pathExists(packageDir))) {
    packageDir = path.join(repoRoot, "src", "package");
  }
  const campaignConfig = await readJson(path.join(campaignDir, "campaign.json"));
  const modulesConfig = await readJson(path.join(campaignDir, "modules.json"));
  const { state } = await loadOrBootstrapState({ repoRoot, campaignId: effectiveCampaignId, stateDir, campaignDir });
  initializeModules(state, modulesConfig);
  const { result } = await loadLatestResult({ repoRoot, campaignId: effectiveCampaignId, stateDir, campaignDir });
  const missionChain = await readMissionChain(effectiveCampaignId, packageDir);
  const currentIndex = missionChain.indexOf(state.current_mission_id || "");
  const nextMissionId = currentIndex >= 0 && currentIndex < missionChain.length - 1
    ? missionChain[currentIndex + 1]
    : state.current_mission_id || missionChain[0] || null;

  return {
    campaign: campaignConfig,
    modules: modulesConfig,
    state,
    result,
    plan: buildGenerationPlan(state, nextMissionId)
  };
}

export async function ingestMissionResult({ repoRoot, campaignId, resultPath, stateDir, advanceHours = 24.0 }) {
  const campaignDir = path.join(repoRoot, "campaigns", campaignId);
  const modulesConfig = await readJson(path.join(campaignDir, "modules.json"));
  const { state, statePath } = await loadOrBootstrapState({ repoRoot, campaignId, stateDir, campaignDir });
  initializeModules(state, modulesConfig);
  const result = await readJson(resultPath);
  ingestResult(state, result, modulesConfig);
  advanceTime(state, advanceHours, modulesConfig);
  state.current_mission_id = result.mission_id;

  await writeJson(statePath, state);

  const effectiveStateDir = stateDir || path.join(repoRoot, "state");
  const historyPath = path.join(effectiveStateDir, campaignId, "mission_results.json");
  let history = [];
  try {
    history = await readJson(historyPath);
  } catch {
    history = [];
  }
  history.push(result);
  await writeJson(historyPath, history);

  return {
    campaign_id: campaignId,
    mission_id: result.mission_id,
    outcome: result.outcome,
    advance_hours: advanceHours,
    state_path: statePath,
    results_path: historyPath
  };
}
