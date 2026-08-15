import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { ensureDir } from "./fs-helpers.mjs";

export function jsonFingerprint(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function readJsonDocument(targetPath) {
  const raw = await fs.readFile(targetPath, "utf8");
  const value = JSON.parse(raw.replace(/^\uFEFF/, ""));
  const stats = await fs.stat(targetPath);
  return { value, fingerprint: jsonFingerprint(value), modifiedAt: stats.mtime.toISOString() };
}

function timestampForPath(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export async function writeJsonSafely(targetPath, payload, options = {}) {
  const { expectedFingerprint = null, backup = true, backupDir = null } = options;
  await ensureDir(path.dirname(targetPath));

  let current = null;
  try {
    current = await readJsonDocument(targetPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  if (expectedFingerprint && current?.fingerprint !== expectedFingerprint) {
    const error = new Error("The file changed on disk after it was loaded. Reload it before saving.");
    error.code = "WRITE_CONFLICT";
    error.currentFingerprint = current?.fingerprint || null;
    throw error;
  }

  let backupPath = null;
  if (backup && current) {
    const destinationDir = backupDir || path.join(path.dirname(targetPath), "backups");
    await ensureDir(destinationDir);
    backupPath = path.join(destinationDir, `${path.basename(targetPath)}.${timestampForPath()}-${crypto.randomBytes(3).toString("hex")}.bak`);
    await fs.copyFile(targetPath, backupPath);
  }

  const tempPath = path.join(path.dirname(targetPath), `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.tmp`);
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;
  try {
    await fs.writeFile(tempPath, serialized, "utf8");
    await fs.rename(tempPath, targetPath);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }

  return {
    path: targetPath,
    backupPath,
    fingerprint: jsonFingerprint(payload)
  };
}

export async function listJsonBackups(targetPath) {
  const backupDir = path.join(path.dirname(targetPath), "backups");
  let entries = [];
  try { entries = await fs.readdir(backupDir, { withFileTypes: true }); } catch { return []; }
  const prefix = `${path.basename(targetPath)}.`;
  return entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith(".bak"))
    .map((entry) => path.join(backupDir, entry.name))
    .sort()
    .reverse();
}

export async function restoreJsonBackup(targetPath, backupPath, options = {}) {
  const allowedRoot = path.resolve(path.dirname(targetPath), "backups");
  const resolvedBackup = path.resolve(backupPath);
  if (path.dirname(resolvedBackup) !== allowedRoot || !path.basename(resolvedBackup).startsWith(`${path.basename(targetPath)}.`)) {
    throw new Error("The selected backup does not belong to this state file.");
  }
  const backup = await readJsonDocument(resolvedBackup);
  return writeJsonSafely(targetPath, backup.value, { expectedFingerprint: options.expectedFingerprint, backup: true });
}

export function validateMissionResult(result) {
  const errors = [];
  if (!result || typeof result !== "object" || Array.isArray(result)) return ["Mission result must be an object."];
  if (!String(result.mission_id || "").trim()) errors.push("mission_id is required.");
  if (!["success", "partial_success", "failure", "abort"].includes(result.outcome)) errors.push("outcome is invalid.");
  if (!Number.isFinite(Number(result.time_elapsed_hours)) || Number(result.time_elapsed_hours) < 0) errors.push("time_elapsed_hours must be zero or greater.");
  if (!Array.isArray(result.events)) errors.push("events must be an array.");
  for (const [index, event] of (result.events || []).entries()) {
    if (!event || typeof event !== "object") {
      errors.push(`events[${index}] must be an object.`);
      continue;
    }
    if (!String(event.event_type || "").trim()) errors.push(`events[${index}].event_type is required.`);
    if (!String(event.unit_id || "").trim()) errors.push(`events[${index}].unit_id is required.`);
    if (["weapon_expended", "unit_damaged"].includes(event.event_type) && (!Number.isFinite(Number(event.amount)) || Number(event.amount) < 0)) {
      errors.push(`events[${index}].amount must be zero or greater.`);
    }
    if (event.event_type === "weapon_expended" && !String(event.weapon_key || "").trim()) errors.push(`events[${index}].weapon_key is required.`);
  }
  return errors;
}

export function validateCampaignState(state) {
  const errors = [];
  if (!state || typeof state !== "object" || Array.isArray(state)) return ["Campaign state must be an object."];
  if (!String(state.metadata?.campaign_id || "").trim()) errors.push("metadata.campaign_id is required.");
  if (!String(state.current_mission_id || "").trim()) errors.push("current_mission_id is required.");
  if (!state.order_of_battle || typeof state.order_of_battle !== "object" || Array.isArray(state.order_of_battle)) errors.push("order_of_battle must be an object.");
  if (!Array.isArray(state.mission_history)) errors.push("mission_history must be an array.");
  if (state.campaign_clock && !Number.isFinite(Date.parse(state.campaign_clock))) errors.push("campaign_clock must be an ISO-compatible date/time.");
  for (const [unitId, unit] of Object.entries(state.order_of_battle || {})) {
    if (!unit || typeof unit !== "object") { errors.push(`order_of_battle.${unitId} must be an object.`); continue; }
    if (Number(unit.damage) < 0 || Number(unit.damage) > 1) errors.push(`${unitId}.damage must be between 0 and 1.`);
    if (Number(unit.readiness) < 0 || Number(unit.readiness) > 1) errors.push(`${unitId}.readiness must be between 0 and 1.`);
    if (!unit.ammo || typeof unit.ammo !== "object" || Array.isArray(unit.ammo)) errors.push(`${unitId}.ammo must be an object.`);
  }
  return errors;
}
