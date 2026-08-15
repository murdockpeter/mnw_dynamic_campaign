import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { normalizeModulesConfig, validateModulesConfig } from "../portable/lib/module-registry.mjs";
import { listJsonBackups, readJsonDocument, restoreJsonBackup, validateMissionResult, writeJsonSafely } from "../portable/lib/safe-write.mjs";
import { ingestMissionResultPayload } from "../portable/lib/runtime.mjs";

test("safe JSON writes create backups and reject stale fingerprints", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mnw-safe-write-"));
  const target = path.join(root, "campaign_state.json");
  await fs.writeFile(target, '{"value":1}\n', "utf8");
  const loaded = await readJsonDocument(target);

  const saved = await writeJsonSafely(target, { value: 2 }, { expectedFingerprint: loaded.fingerprint });
  assert.ok(saved.backupPath);
  assert.deepEqual(JSON.parse(await fs.readFile(saved.backupPath, "utf8")), { value: 1 });
  assert.deepEqual(await listJsonBackups(target), [saved.backupPath]);

  await assert.rejects(
    writeJsonSafely(target, { value: 3 }, { expectedFingerprint: loaded.fingerprint }),
    (error) => error.code === "WRITE_CONFLICT"
  );
  const current = await readJsonDocument(target);
  await restoreJsonBackup(target, saved.backupPath, { expectedFingerprint: current.fingerprint });
  assert.deepEqual(JSON.parse(await fs.readFile(target, "utf8")), { value: 1 });
  await fs.rm(root, { recursive: true, force: true });
});

test("module configuration is discoverable, normalized, and rejects unknown modules", () => {
  const normalized = normalizeModulesConfig({
    enabled_modules: ["ammo"],
    module_config: { ammo: { allow_negative: true }, damage: { repair_rate_per_day: 9 } }
  });
  assert.deepEqual(normalized.enabled_modules, ["ammo"]);
  assert.equal(normalized.module_config.ammo.allow_negative, true);
  assert.equal(normalized.module_config.damage.repair_rate_per_day, 1);
  assert.deepEqual(validateModulesConfig({ enabled_modules: ["weather"] }), ["Unknown module: weather."]);
});

test("mission result validation catches malformed event rows", () => {
  const errors = validateMissionResult({
    mission_id: "",
    outcome: "victory",
    time_elapsed_hours: -1,
    events: [{ event_type: "weapon_expended", unit_id: "unit", amount: -2 }]
  });
  assert.ok(errors.length >= 4);
});

test("portable runtime honors disabled damage and ammo modules", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mnw-modules-"));
  const campaignId = "module_test";
  const campaignDir = path.join(root, "campaigns", campaignId);
  const packageDir = path.join(root, "src", "packages", campaignId, campaignId);
  await fs.mkdir(campaignDir, { recursive: true });
  await fs.mkdir(packageDir, { recursive: true });
  const state = {
    metadata: { campaign_id: campaignId, title: "Module Test", theater: "Norwegian Sea" },
    current_mission_id: `${campaignId}.${campaignId}.scenario_01`,
    campaign_clock: "2028-01-01T00:00:00Z",
    order_of_battle: {
      player: { unit_id: "player", name: "Player", faction: "US", platform_type: "submarine", damage: 0, readiness: 1, destroyed: false, ammo: { mk48: 4 } }
    },
    mission_history: [],
    module_state: {},
    world_state: {}
  };
  await fs.writeFile(path.join(campaignDir, "bootstrap_state.json"), JSON.stringify(state), "utf8");
  await fs.writeFile(path.join(campaignDir, "modules.json"), JSON.stringify({ enabled_modules: [], module_config: {} }), "utf8");
  await fs.writeFile(path.join(packageDir, "quest.cmp"), `_start = Mis("${campaignId}.${campaignId}.scenario_01")\n`, "utf8");

  await ingestMissionResultPayload({
    repoRoot: root,
    campaignId,
    advanceHours: 24,
    result: {
      mission_id: `${campaignId}.${campaignId}.scenario_01`,
      outcome: "success",
      time_elapsed_hours: 1,
      events: [
        { event_type: "weapon_expended", unit_id: "player", weapon_key: "mk48", amount: 2 },
        { event_type: "unit_damaged", unit_id: "player", amount: 0.5 }
      ],
      metadata: {}
    }
  });

  const persisted = JSON.parse(await fs.readFile(path.join(root, "state", campaignId, "campaign_state.json"), "utf8"));
  assert.equal(persisted.order_of_battle.player.ammo.mk48, 4);
  assert.equal(persisted.order_of_battle.player.damage, 0);
  assert.deepEqual(persisted.enabled_modules, []);
  assert.equal(persisted.campaign_clock, "2028-01-02T00:00:00.000Z");
  await fs.rm(root, { recursive: true, force: true });
});
