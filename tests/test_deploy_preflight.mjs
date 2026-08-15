import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { deployPackage, inspectPackageIdentity } from "../portable/lib/deploy-package.mjs";
import { readZipEntry, writeStoredZip } from "../portable/lib/zip-store.mjs";

function quest(campaignId, missionId) {
  return Buffer.from(`_start = Mis("${campaignId}.${campaignId}.${missionId}")\n`, "utf8");
}

test("deployment blocks duplicate campaign identities in differently named archives", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mnw-deploy-"));
  const source = path.join(root, "incoming.kyt");
  const target = path.join(root, "live");
  await fs.mkdir(target);
  await writeStoredZip(source, [{ name: "demo/quest.cmp", data: quest("demo", "one") }]);
  assert.match((await readZipEntry(source, "demo/quest.cmp")).toString("utf8"), /demo\.demo\.one/);
  await writeStoredZip(path.join(target, "backup.kyt"), [{ name: "demo/quest.cmp", data: quest("demo", "one") }]);

  const identity = await inspectPackageIdentity(source);
  assert.deepEqual(identity.campaignIds, ["demo"]);
  assert.deepEqual(identity.missionIds, ["demo.demo.one"]);
  await assert.rejects(
    deployPackage({ packagePath: source, gameCampaignPath: target, userCampaignPath: "" }),
    (error) => error.code === "PACKAGE_IDENTITY_COLLISION" && error.collisions.length === 1
  );
  await fs.rm(root, { recursive: true, force: true });
});

test("deployment permits replacing the same archive filename", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mnw-replace-"));
  const sourceDir = path.join(root, "source");
  const target = path.join(root, "live");
  await fs.mkdir(sourceDir);
  await fs.mkdir(target);
  const source = path.join(sourceDir, "demo.kyt");
  await writeStoredZip(source, [{ name: "demo/quest.cmp", data: quest("demo", "one") }]);
  await writeStoredZip(path.join(target, "demo.kyt"), [{ name: "demo/quest.cmp", data: quest("demo", "old") }]);
  const result = await deployPackage({ packagePath: source, gameCampaignPath: target, userCampaignPath: "" });
  assert.equal(result.deployedPaths.length, 1);
  await fs.rm(root, { recursive: true, force: true });
});
