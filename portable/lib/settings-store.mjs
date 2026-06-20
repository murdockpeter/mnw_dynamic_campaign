import fs from "node:fs/promises";
import path from "node:path";

import { defaultGamePaths, ensureDir } from "./fs-helpers.mjs";

function defaultSettings() {
  const defaults = defaultGamePaths();
  return {
    gameCampaignPath: defaults.gameCampaignPath,
    userCampaignPath: defaults.userCampaignPath,
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
    firstLaunchComplete: false
  };
}

export async function loadSettings(settingsPath) {
  try {
    const raw = await fs.readFile(settingsPath, "utf8");
    const payload = JSON.parse(raw.replace(/^\uFEFF/, ""));
    return {
      ...defaultSettings(),
      ...payload
    };
  } catch {
    return defaultSettings();
  }
}

export async function saveSettings(settingsPath, nextSettings) {
  const merged = {
    ...defaultSettings(),
    ...nextSettings
  };
  await ensureDir(path.dirname(settingsPath));
  await fs.writeFile(settingsPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return merged;
}
