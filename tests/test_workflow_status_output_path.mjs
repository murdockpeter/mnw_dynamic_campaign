import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getWorkflowStatusForDesktop, saveSettingsForDesktop } from "../portable/lib/desktop-api.mjs";

test("getWorkflowStatusForDesktop tolerates a directory-valued preferredPackageOutputPath", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mnw-workflow-status-"));
  const workspaceRoot = path.join(tempRoot, "workspace");
  const contentRoot = workspaceRoot;
  const settingsPath = path.join(tempRoot, "settings.json");

  await fs.mkdir(path.join(workspaceRoot, "dist"), { recursive: true });

  await saveSettingsForDesktop({
    settingsPath,
    settings: {
      preferredCampaignId: "silent_meridian",
      preferredPackageId: "silent_meridian",
      preferredPackageOutputPath: path.join(workspaceRoot, "dist")
    }
  });

  const status = await getWorkflowStatusForDesktop({
    campaignId: "silent_meridian",
    packageId: "silent_meridian",
    settingsPath,
    contentRoot,
    workspaceRoot
  });

  assert.equal(status.outputPath, path.join(workspaceRoot, "dist", "silent_meridian.kyt"));
  assert.equal(status.steps.find((step) => step.key === "build")?.state, "pending");

  await fs.rm(tempRoot, { recursive: true, force: true });
});
