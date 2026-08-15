import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { encode } from "@msgpack/msgpack";

import { buildLocalPlatformCatalog, deriveDbDirFromCampaignPath, filterPlatformCatalog } from "../portable/lib/local-db-catalog.mjs";
import { writeStoredZip } from "../portable/lib/zip-store.mjs";

function platformRow(name, year, tag, imageRoot) {
  return [0, name, 0, "Description", 0, 0, year, [tag], [`${imageRoot}/image.jpg`]];
}

test("portable local DB indexing normalizes installed platforms without bundling extracted data", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mnw-local-db-"));
  const archivePath = path.join(root, "test.core");
  await writeStoredZip(archivePath, [
    { name: "submarines.msg", data: Buffer.from(encode({ 74: platformRow("Virginia Block I", 2008, "usn/submarines/virginia-b1", "submarines") })) },
    { name: "ships.msg", data: Buffer.from(encode({ 3883: platformRow("Type 055 Renhai", 2020, "plan/ships/type-055", "ships") })) },
    { name: "aircrafts.msg", data: Buffer.from(encode({ 2705: platformRow("P-8A Poseidon", 2013, "usn/aircrafts/p-8a", "aircrafts") })) },
    { name: "element_names.msg", data: Buffer.from(encode({ 1001: [1, "USS Virginia", "SSN-774", "774", 74, 0, 0, 0, 0, 0, 0, 0, ["usn/submarines/virginia-b1"]] })) }
  ]);

  const catalog = await buildLocalPlatformCatalog({ dbDir: root });
  assert.equal(catalog.platforms.length, 3);
  assert.ok(catalog.units.some((unit) => unit.dbid === 1001 && unit.namedHull));
  assert.ok(catalog.units.some((unit) => unit.dbid === 3883 && unit.faction === "CN" && !unit.namedHull));
  assert.deepEqual(filterPlatformCatalog(catalog, { factions: ["US"], roles: ["maritime_patrol_aircraft"], year: 2028 }).map((unit) => unit.dbid), [2705]);
  assert.match(deriveDbDirFromCampaignPath("C:/Games/MNW/Var/Scenarios/Packages/Campaigns"), /Var[\\/]DB$/);
  await fs.rm(root, { recursive: true, force: true });
});
