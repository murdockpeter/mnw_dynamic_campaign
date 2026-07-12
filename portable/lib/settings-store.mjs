import fs from "node:fs/promises";
import path from "node:path";

import { ensureDir } from "./fs-helpers.mjs";

function defaultSettings() {
  return {
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
      provider: "generic",
      feedUrl: "",
      githubOwner: "",
      githubRepo: "",
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
      ...(payload.updates || {})
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
  await ensureDir(path.dirname(settingsPath));
  await fs.writeFile(settingsPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return merged;
}
