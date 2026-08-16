import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { appendContinuationScenario } from "../portable/lib/continue-campaign.mjs";
import { generateCampaign } from "../portable/lib/generate-campaign.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function createCampaignWorkspace(campaignId) {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mnw-continuation-"));
  await generateCampaign({
    templateRoot: repoRoot,
    workspaceRoot,
    spec: {
      title: "Continuation Slot Test",
      campaignId,
      campaignSeed: campaignId,
      theater: "south_china_sea",
      missionType: "asw",
      year: 2028,
      scenarioCount: 1,
      playerName: "USS Test"
    }
  });
  return workspaceRoot;
}

test("continuation rewrites the slot after the latest saved result when current mission state is stale", async () => {
  const campaignId = "stale_slot_test";
  const workspaceRoot = await createCampaignWorkspace(campaignId);
  const stateDir = path.join(workspaceRoot, "state");
  const campaignDir = path.join(workspaceRoot, "campaigns", campaignId);
  const packageDir = path.join(workspaceRoot, "src", "packages", campaignId, campaignId);
  const statePath = path.join(stateDir, campaignId, "campaign_state.json");
  const resultsPath = path.join(stateDir, campaignId, "mission_results.json");
  const missionOneId = `${campaignId}.${campaignId}.scenario_01`;
  const missionTwoId = `${campaignId}.${campaignId}.scenario_02`;

  const state = JSON.parse(await fs.readFile(path.join(campaignDir, "bootstrap_state.json"), "utf8"));
  state.current_mission_id = missionOneId;
  state.mission_history.push({
    mission_id: missionOneId,
    outcome: "success",
    time_elapsed_hours: 4,
    event_count: 0,
    notes: { source: "regression_test" }
  });
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await fs.writeFile(resultsPath, `${JSON.stringify([{ mission_id: missionOneId, outcome: "success", events: [] }], null, 2)}\n`, "utf8");

  const missionOneBefore = await fs.readFile(path.join(packageDir, "scenario_01.mis"), "utf8");
  const result = await appendContinuationScenario({
    repoRoot: workspaceRoot,
    campaignId,
    objective: "pursue_contact",
    riskPosture: "balanced",
    operationalTempo: "deliberate",
    stateDir
  });

  assert.equal(result.mission_id, missionTwoId);
  assert.equal(result.next_reserved_mission_id, `${campaignId}.${campaignId}.scenario_03`);
  assert.equal(await fs.readFile(path.join(packageDir, "scenario_01.mis"), "utf8"), missionOneBefore);
  const quest = await fs.readFile(path.join(packageDir, "quest.cmp"), "utf8");
  assert.match(quest, /scenario_01/);
  assert.match(quest, /scenario_02/);
  assert.match(quest, /scenario_03/);
  const persistedState = JSON.parse(await fs.readFile(statePath, "utf8"));
  assert.equal(persistedState.current_mission_id, missionTwoId);

  await fs.rm(workspaceRoot, { recursive: true, force: true });
});

test("continuation refuses to overwrite the opening mission before a result is saved", async () => {
  const campaignId = "missing_result_test";
  const workspaceRoot = await createCampaignWorkspace(campaignId);

  await assert.rejects(
    appendContinuationScenario({
      repoRoot: workspaceRoot,
      campaignId,
      objective: "pursue_contact",
      riskPosture: "balanced",
      operationalTempo: "deliberate"
    }),
    /No saved mission result is available/
  );

  await fs.rm(workspaceRoot, { recursive: true, force: true });
});
