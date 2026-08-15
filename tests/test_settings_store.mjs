import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { loadSettings, saveSettings, SETTINGS_SCHEMA_VERSION } from "../portable/lib/settings-store.mjs";

test("loadSettings preserves nested defaults for legacy settings files", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mnw-settings-"));
  const settingsPath = path.join(tempRoot, "settings.json");

  await fs.writeFile(settingsPath, JSON.stringify({
    preferredCampaignId: "iron_archipelago",
    ais: {
      enabled: true
    },
    updates: {
      feedUrl: "https://example.com/releases"
    }
  }), "utf8");

  const settings = await loadSettings(settingsPath);

  assert.equal(settings.preferredCampaignId, "iron_archipelago");
  assert.equal(settings.ais.enabled, true);
  assert.equal(settings.ais.provider, "aisstream");
  assert.equal(settings.updates.provider, "generic");
  assert.equal(settings.updates.feedUrl, "https://example.com/releases");
  assert.equal(settings.updates.autoCheckOnLaunch, true);
  assert.equal(settings.updates.githubOwner, "murdockpeter");
  assert.equal(settings.schemaVersion, SETTINGS_SCHEMA_VERSION);

  const saved = await saveSettings(settingsPath, settings);
  assert.equal(saved.schemaVersion, SETTINGS_SCHEMA_VERSION);
  const backups = await fs.readdir(path.join(tempRoot, "backups"));
  assert.equal(backups.length, 1);

  await fs.rm(tempRoot, { recursive: true, force: true });
});
