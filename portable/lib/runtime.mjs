import fs from "node:fs/promises";
import path from "node:path";

import { readJson, writeJson } from "./fs-helpers.mjs";
import { findTheaterTemplateByName } from "../../shared/campaign-generator.mjs";
import { listModules, normalizeModulesConfig } from "./module-registry.mjs";
import { jsonFingerprint, validateCampaignState, validateMissionResult, writeJsonSafely } from "./safe-write.mjs";

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function initializeModules(state, modulesConfig) {
  modulesConfig = normalizeModulesConfig(modulesConfig);
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

function titleizeToken(value) {
  return String(value || "")
    .split(/[_\s]+/g)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function summarizeTheaterRole(unit) {
  if (Array.isArray(unit.tags) && unit.tags.includes("player")) {
    return `Player ${titleizeToken(unit.platform_type)}`;
  }
  if (unit.notes?.role) {
    return titleizeToken(unit.notes.role);
  }
  if (unit.notes?.theater_role) {
    return titleizeToken(unit.notes.theater_role);
  }
  return titleizeToken(unit.platform_type);
}

function summarizeTheaterStatus(unit, track) {
  if (unit.destroyed) {
    return "Destroyed";
  }
  if (track?.on_stage) {
    return "On stage";
  }
  if (track?.operational_state === "repairing") {
    return `Repairing (${Math.ceil(Number(track.recovery_hours_remaining || 0))}h)`;
  }
  if (track?.operational_state === "rearming") {
    return `Rearming (${Math.ceil(Number(track.recovery_hours_remaining || 0))}h)`;
  }
  if (track?.operational_state === "in_transit") {
    return `In transit (${Math.ceil(Number(track.recovery_hours_remaining || 0))}h)`;
  }
  if (track?.availability === "committed") {
    return "Committed";
  }
  const damage = Number(unit.damage || 0);
  if (damage > 0) {
    return `Damaged ${Math.round(damage * 100)}%`;
  }
  return track?.availability === "available" ? "Available" : titleizeToken(track?.availability || "available");
}

function buildTheaterDebugPayload(campaignConfig, state) {
  const theater = findTheaterTemplateByName(campaignConfig?.theater);
  if (!theater) {
    return null;
  }

  const picture = state.world_state?.theater_picture || {};
  const pictureUnits = picture.units || {};
  const sectors = Array.isArray(picture.sectors) ? picture.sectors : [];
  const units = Object.values(state.order_of_battle || {}).map((unit) => {
    const track = pictureUnits[unit.unit_id] || {};
    const allowedSectors = Array.isArray(unit.notes?.sectors) ? unit.notes.sectors : [];
    return {
      unitId: unit.unit_id,
      name: unit.name,
      side: unit.faction,
      role: summarizeTheaterRole(unit),
      theaterRole: unit.notes?.theater_role || null,
      platformType: unit.platform_type,
      currentSector: track.current_sector || unit.notes?.current_sector || allowedSectors[0] || null,
      allowedSectors,
      availability: track.availability || unit.notes?.availability || "available",
      operationalState: track.operational_state || "available",
      onStage: Boolean(track.on_stage),
      lastMissionId: track.last_mission_id || null,
      lastAssignedIndex: Number.isFinite(track.last_assigned_index) ? track.last_assigned_index : null,
      destroyed: Boolean(unit.destroyed),
      damage: Number(unit.damage || 0),
      readiness: Number(unit.readiness ?? 1),
      fatigue: Number(track.fatigue || 0),
      sorties: Number(track.sorties || 0),
      recoveryHoursRemaining: Number(track.recovery_hours_remaining || 0),
      status: summarizeTheaterStatus(unit, track)
    };
  });

  return {
    theaterId: theater.id,
    theaterLabel: theater.label,
    theaterName: theater.theaterName,
    family: theater.family,
    escalationKey: state.world_state?.escalation_key || null,
    escalationLevel: Number.isFinite(Number(state.world_state?.escalation_level)) ? Number(state.world_state.escalation_level) : null,
    campaignClimate: state.world_state?.campaign_climate || state.world_state?.tone || null,
    campaignSeed: state.world_state?.campaign_seed || state.metadata?.campaign_seed || state.metadata?.campaign_id || null,
    missionType: state.world_state?.mission_type || null,
    season: state.world_state?.season || null,
    seasonLabel: state.world_state?.season_label || null,
    timeOfDay: state.world_state?.time_of_day || null,
    timeOfDayLabel: state.world_state?.time_of_day_label || null,
    playerSubmarine: state.world_state?.player_submarine || null,
    playerSubmarineLabel: state.world_state?.player_submarine_label || null,
    playerSubmarinePlatformDbid: state.world_state?.player_submarine_platform_dbid || null,
    playerSubmarineVerifiedDb: state.world_state?.player_submarine_verified_db ?? null,
    experimentalFeatures: state.world_state?.experimental_features || null,
    missionStance: state.world_state?.mission_stance || state.world_state?.posture || null,
    rulesOfEngagement: state.world_state?.rules_of_engagement || null,
    source: picture.units ? "runtime" : "seed",
    sectors,
    units
  };
}

export function ingestResult(state, result, modulesConfig) {
  modulesConfig = normalizeModulesConfig(modulesConfig);
  const damageEnabled = modulesConfig.enabled_modules.includes("damage");
  const ammoEnabled = modulesConfig.enabled_modules.includes("ammo");
  const allowNegative = Boolean(modulesConfig.module_config?.ammo?.allow_negative);
  const repairRate = Number(modulesConfig.module_config?.damage?.repair_rate_per_day ?? 0.08);

  for (const event of result.events || []) {
    if (!event.unit_id || !state.order_of_battle[event.unit_id]) {
      continue;
    }

    const unit = state.order_of_battle[event.unit_id];
    if (ammoEnabled && event.event_type === "weapon_expended" && event.weapon_key) {
      const current = Number(unit.ammo?.[event.weapon_key] ?? 0);
      const nextValue = current - Number(event.amount || 0);
      unit.ammo[event.weapon_key] = allowNegative ? nextValue : Math.max(0, nextValue);
    }

    if (damageEnabled && event.event_type === "unit_damaged") {
      const damage = Math.max(0, Math.min(1, Number(unit.damage || 0) + Number(event.amount || 0)));
      unit.damage = damage;
      unit.readiness = Math.max(0, 1 - damage);
    }

    if (damageEnabled && event.event_type === "unit_destroyed") {
      unit.destroyed = true;
      unit.damage = 1.0;
      unit.readiness = 0.0;
    }
  }

  const theaterUnits = state.world_state?.theater_picture?.units || {};
  for (const track of Object.values(theaterUnits)) {
    if (!track?.unit_id) continue;
    const unit = state.order_of_battle?.[track.unit_id];
    if (!unit) continue;
    const isPlayer = Array.isArray(unit.tags) && unit.tags.includes("player");
    if (!track.on_stage && !isPlayer) continue;

    const unitClass = String(unit.class || unit.unit_type || track.class || "").toLowerCase();
    const baseRecovery = unitClass.includes("air") || unitClass.includes("helicopter")
      ? 18
      : unitClass.includes("sub")
        ? 14
        : 30;
    const ammoValues = Object.values(unit.ammo || {}).map(Number).filter(Number.isFinite);
    const lowAmmo = ammoEnabled && ammoValues.length > 0 && ammoValues.reduce((sum, value) => sum + value, 0) <= 2;
    const damaged = Number(unit.damage || 0) >= 0.25;
    const recoveryHours = damaged
      ? Math.max(baseRecovery, Math.ceil(Number(unit.damage || 0) * 240))
      : lowAmmo
        ? Math.max(baseRecovery, 24)
        : baseRecovery;

    track.on_stage = false;
    track.last_mission_id = result.mission_id || null;
    track.sorties = Number(track.sorties || 0) + 1;
    track.fatigue = Math.min(1, Number(track.fatigue || 0) + 0.2);
    track.recovery_hours_remaining = Math.max(Number(track.recovery_hours_remaining || 0), recoveryHours);
    if (unit.destroyed) {
      track.operational_state = "destroyed";
      track.availability = "destroyed";
      track.recovery_hours_remaining = 0;
    } else if (damaged) {
      track.operational_state = "repairing";
      track.availability = "unavailable";
    } else if (lowAmmo) {
      track.operational_state = "rearming";
      track.availability = "unavailable";
    } else {
      track.operational_state = "in_transit";
      track.availability = "unavailable";
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

  if (damageEnabled) {
    state.module_state = state.module_state || {};
    state.module_state.damage = state.module_state.damage || {};
    state.module_state.damage.repair_rate_per_day = repairRate;
  }

  return state;
}

export function advanceTime(state, hours, modulesConfig) {
  modulesConfig = normalizeModulesConfig(modulesConfig);
  const elapsedHours = Number(hours || 0);
  if (elapsedHours !== 0 && state.campaign_clock && Number.isFinite(Date.parse(state.campaign_clock)) && Number.isFinite(elapsedHours)) {
    state.campaign_clock = new Date(Date.parse(state.campaign_clock) + elapsedHours * 60 * 60 * 1000).toISOString();
  }
  const damageEnabled = modulesConfig.enabled_modules.includes("damage");
  if (damageEnabled) {
    const repairRate = Number(modulesConfig.module_config?.damage?.repair_rate_per_day ?? 0.08);
    const repairDelta = repairRate * (elapsedHours / 24.0);
    for (const unit of Object.values(state.order_of_battle || {})) {
      if (unit.destroyed || Number(unit.damage || 0) <= 0) continue;
      unit.damage = Math.max(0, Number(unit.damage || 0) - repairDelta);
      unit.readiness = Math.max(0, 1 - unit.damage);
    }
  }

  for (const track of Object.values(state.world_state?.theater_picture?.units || {})) {
    const unit = state.order_of_battle?.[track.unit_id];
    if (!unit) continue;
    if (unit.destroyed) {
      track.operational_state = "destroyed";
      track.availability = "destroyed";
      track.on_stage = false;
      track.recovery_hours_remaining = 0;
      continue;
    }

    track.fatigue = Math.max(0, Number(track.fatigue || 0) - Math.max(0, elapsedHours) / 120);
    track.recovery_hours_remaining = Math.max(0, Number(track.recovery_hours_remaining || 0) - Math.max(0, elapsedHours));
    if (track.recovery_hours_remaining > 0) continue;

    if (Number(unit.damage || 0) >= 0.25) {
      track.operational_state = "repairing";
      track.availability = "unavailable";
      track.recovery_hours_remaining = Math.max(12, Math.ceil(Number(unit.damage || 0) * 120));
    } else {
      track.operational_state = "available";
      track.availability = "available";
      track.on_stage = false;
    }
  }
  return state;
}

function summarizeStateDelta(before, after) {
  const units = [];
  const unitIds = new Set([...Object.keys(before.order_of_battle || {}), ...Object.keys(after.order_of_battle || {})]);
  for (const unitId of unitIds) {
    const prior = before.order_of_battle?.[unitId] || {};
    const next = after.order_of_battle?.[unitId] || {};
    const changes = {};
    for (const key of ["damage", "readiness", "destroyed"]) {
      if (prior[key] !== next[key]) changes[key] = { before: prior[key], after: next[key] };
    }
    const ammoKeys = new Set([...Object.keys(prior.ammo || {}), ...Object.keys(next.ammo || {})]);
    const ammo = {};
    for (const key of ammoKeys) {
      if (prior.ammo?.[key] !== next.ammo?.[key]) ammo[key] = { before: prior.ammo?.[key], after: next.ammo?.[key] };
    }
    if (Object.keys(ammo).length) changes.ammo = ammo;
    if (Object.keys(changes).length) units.push({ unitId, name: next.name || prior.name || unitId, changes });
  }
  return {
    units,
    missionHistory: {
      before: before.mission_history?.length || 0,
      after: after.mission_history?.length || 0
    },
    campaignClock: { before: before.campaign_clock || null, after: after.campaign_clock || null }
  };
}

export function previewMissionResult({ state, result, modulesConfig, advanceHours = 24 }) {
  const errors = validateMissionResult(result);
  if (errors.length) return { valid: false, errors, delta: null, nextState: null };
  const before = structuredClone(state);
  const nextState = structuredClone(state);
  initializeModules(nextState, modulesConfig);
  ingestResult(nextState, result, modulesConfig);
  advanceTime(nextState, advanceHours, modulesConfig);
  return { valid: true, errors: [], delta: summarizeStateDelta(before, nextState), nextState };
}

async function ingestMissionResultRecord({ repoRoot, campaignId, result, stateDir, advanceHours = 24.0, expectedStateFingerprint = null }) {
  const campaignDir = path.join(repoRoot, "campaigns", campaignId);
  let packageDir = path.join(repoRoot, "src", "packages", campaignId);
  if (!(await pathExists(packageDir))) {
    packageDir = path.join(repoRoot, "src", "package");
  }
  const modulesConfig = normalizeModulesConfig(await readJson(path.join(campaignDir, "modules.json")));
  const { state, statePath } = await loadOrBootstrapState({ repoRoot, campaignId, stateDir, campaignDir });
  const loadedStateFingerprint = jsonFingerprint(state);
  if (expectedStateFingerprint && loadedStateFingerprint !== expectedStateFingerprint) {
    const error = new Error("Campaign state changed after the result preview. Refresh Campaign Tracking before saving.");
    error.code = "WRITE_CONFLICT";
    throw error;
  }
  const resultErrors = validateMissionResult(result);
  if (resultErrors.length) throw new Error(`Invalid mission result: ${resultErrors.join(" ")}`);
  const stateErrors = validateCampaignState(state);
  if (stateErrors.length) throw new Error(`Invalid campaign state: ${stateErrors.join(" ")}`);
  initializeModules(state, modulesConfig);
  ingestResult(state, result, modulesConfig);
  advanceTime(state, advanceHours, modulesConfig);
  const missionChain = await readMissionChain(campaignId, packageDir);
  const currentIndex = missionChain.indexOf(result.mission_id || "");
  const nextMissionId = currentIndex >= 0 && currentIndex < missionChain.length - 1
    ? missionChain[currentIndex + 1]
    : result.mission_id;
  state.current_mission_id = nextMissionId;

  const stateWrite = await writeJsonSafely(statePath, state, { expectedFingerprint: loadedStateFingerprint });

  const effectiveStateDir = stateDir || path.join(repoRoot, "state");
  const historyPath = path.join(effectiveStateDir, campaignId, "mission_results.json");
  let history = [];
  try {
    history = await readJson(historyPath);
  } catch {
    history = [];
  }
  history.push(result);
  const historyWrite = await writeJsonSafely(historyPath, history);

  return {
    campaign_id: campaignId,
    mission_id: result.mission_id,
    next_mission_id: nextMissionId,
    outcome: result.outcome,
    advance_hours: advanceHours,
    state_path: statePath,
    results_path: historyPath,
    state_backup_path: stateWrite.backupPath,
    results_backup_path: historyWrite.backupPath
  };
}

export async function readMissionChain(campaignId, packageDir) {
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
  const modulesConfig = normalizeModulesConfig(await readJson(path.join(campaignDir, "modules.json")));
  const { state, statePath } = await loadOrBootstrapState({ repoRoot, campaignId: effectiveCampaignId, stateDir, campaignDir });
  initializeModules(state, modulesConfig);
  const { result } = await loadLatestResult({ repoRoot, campaignId: effectiveCampaignId, stateDir, campaignDir });
  const missionChain = await readMissionChain(effectiveCampaignId, packageDir);
  const currentIndex = missionChain.indexOf(state.current_mission_id || "");
  const nextMissionId = currentIndex >= 0 && currentIndex < missionChain.length - 1
    ? missionChain[currentIndex + 1]
    : state.current_mission_id || missionChain[0] || null;

  return {
    campaign: campaignConfig,
    modules: {
      ...modulesConfig,
      registry: listModules()
    },
    state,
    persistence: {
      statePath,
      stateFingerprint: jsonFingerprint(state)
    },
    result,
    plan: buildGenerationPlan(state, nextMissionId),
    debug: {
      theater: buildTheaterDebugPayload(campaignConfig, state)
    }
  };
}

export async function ingestMissionResult({ repoRoot, campaignId, resultPath, stateDir, advanceHours = 24.0, expectedStateFingerprint = null }) {
  const result = await readJson(resultPath);
  return ingestMissionResultRecord({ repoRoot, campaignId, result, stateDir, advanceHours, expectedStateFingerprint });
}

export async function ingestMissionResultPayload({ repoRoot, campaignId, result, stateDir, advanceHours = 24.0, expectedStateFingerprint = null }) {
  return ingestMissionResultRecord({ repoRoot, campaignId, result, stateDir, advanceHours, expectedStateFingerprint });
}
