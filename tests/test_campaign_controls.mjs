import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  loadCampaignControlsForDesktop,
  exportSupportBundleForDesktop,
  restoreCampaignStateForDesktop,
  saveCampaignStateForDesktop,
  saveModuleConfigForDesktop
} from "../portable/lib/desktop-api.mjs";
import { readZipEntries } from "../portable/lib/zip-store.mjs";

test("desktop campaign controls safely save modules, state, and restore backups", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mnw-controls-"));
  const campaignId = "controls_test";
  const campaignDir = path.join(root, "campaigns", campaignId);
  const stateDir = path.join(root, "state", campaignId);
  await fs.mkdir(campaignDir, { recursive: true });
  await fs.mkdir(stateDir, { recursive: true });
  const state = {
    metadata: { campaign_id: campaignId, title: "Controls Test", theater: "Norwegian Sea" },
    current_mission_id: "controls_test.controls_test.one",
    campaign_clock: "2028-01-01T00:00:00Z",
    order_of_battle: { player: { unit_id: "player", name: "Player", damage: 0, readiness: 1, ammo: {} } },
    mission_history: [],
    module_state: { damage: { repair_rate_per_day: 0.08 } },
    world_state: {}
  };
  await fs.writeFile(path.join(campaignDir, "bootstrap_state.json"), JSON.stringify(state), "utf8");
  await fs.writeFile(path.join(campaignDir, "modules.json"), JSON.stringify({ enabled_modules: ["damage", "ammo"], module_config: {} }), "utf8");
  await fs.writeFile(path.join(campaignDir, "campaign.json"), JSON.stringify({ campaign_id: campaignId, theater: "Norwegian Sea" }), "utf8");
  await fs.writeFile(path.join(campaignDir, "bootstrap_result.json"), JSON.stringify({ mission_id: state.current_mission_id, outcome: "success", time_elapsed_hours: 0, events: [] }), "utf8");
  await fs.writeFile(path.join(stateDir, "campaign_state.json"), JSON.stringify(state), "utf8");
  const packageDir = path.join(root, "src", "packages", campaignId, campaignId);
  await fs.mkdir(packageDir, { recursive: true });
  await fs.writeFile(path.join(packageDir, "quest.cmp"), `_start = Mis("${state.current_mission_id}")\n`, "utf8");

  const context = { campaignId, contentRoot: root, workspaceRoot: root, appVersion: "test" };
  let controls = await loadCampaignControlsForDesktop(context);
  const moduleSave = await saveModuleConfigForDesktop({
    ...context,
    expectedFingerprint: controls.modulesFingerprint,
    confirmDisableWithState: true,
    modules: { enabled_modules: ["ammo"], module_config: { ammo: { allow_negative: true } } }
  });
  assert.deepEqual(moduleSave.modules.enabled_modules, ["ammo"]);

  const edited = structuredClone(controls.state);
  edited.campaign_clock = "2028-01-02T00:00:00Z";
  const stateSave = await saveCampaignStateForDesktop({ ...context, state: edited, expectedFingerprint: controls.stateFingerprint });
  assert.ok(stateSave.backupPath);
  controls = await loadCampaignControlsForDesktop(context);
  assert.equal(controls.stateBackups.length, 1);
  const restored = await restoreCampaignStateForDesktop({
    ...context,
    backupPath: controls.stateBackups[0],
    expectedFingerprint: controls.stateFingerprint
  });
  assert.equal(restored.state.campaign_clock, "2028-01-01T00:00:00Z");
  assert.ok(restored.auditPath);
  const support = await exportSupportBundleForDesktop(context);
  const supportEntries = await readZipEntries(support.outputPath);
  assert.ok(supportEntries.has("settings.redacted.json"));
  assert.ok(supportEntries.has("runtime.json"));
  await fs.rm(root, { recursive: true, force: true });
});
