import fs from "node:fs/promises";
import path from "node:path";

import { ensureDir } from "./fs-helpers.mjs";
import { writeJsonSafely } from "./safe-write.mjs";

export const SETTINGS_SCHEMA_VERSION = 2;

function defaultSettings() {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    gameCampaignPath: "",
    userCampaignPath: "",
    preferredCampaignId: "silent_meridian",
    preferredPackageId: "silent_meridian",
    preferredPackageSourceDir: "",
    preferredPackageOutputPath: "",
    ais: {
      enabled: false,
      provider: "aisstream",
      endpointTemplate: "",
      token: "",
      queryRadiusKm: 160,
      latestSample: null
    },
    updates: {
      provider: "github",
      feedUrl: "",
      githubOwner: "murdockpeter",
      githubRepo: "mnw_dynamic_campaign",
      autoCheckOnLaunch: true
    },
    firstLaunchComplete: false
  };
}

function mergeSettings(payload = {}) {
  const defaults = defaultSettings();
  return {
    ...defaults,
    ...payload,
    ais: {
      ...defaults.ais,
      ...(payload.ais || {})
    },
    updates: {
      ...defaults.updates,
      ...(payload.updates || {}),
      provider: payload.updates?.provider || (payload.updates?.feedUrl ? "generic" : defaults.updates.provider)
    }
  };
}

export async function loadSettings(settingsPath) {
  try {
    const raw = await fs.readFile(settingsPath, "utf8");
    const payload = JSON.parse(raw.replace(/^\uFEFF/, ""));
    return mergeSettings(payload);
  } catch {
    return defaultSettings();
  }
}

export async function saveSettings(settingsPath, nextSettings) {
  const merged = mergeSettings(nextSettings);
  merged.schemaVersion = SETTINGS_SCHEMA_VERSION;
  await ensureDir(path.dirname(settingsPath));
  await writeJsonSafely(settingsPath, merged);
  return merged;
}
