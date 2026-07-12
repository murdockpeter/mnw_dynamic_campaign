import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ensureWorkspace } from "../portable/lib/workspace-bootstrap.mjs";

async function writeFile(targetPath, content) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, "utf8");
}

test("ensureWorkspace refreshes unchanged seeded files without overwriting user edits", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mnw-workspace-bootstrap-"));
  const contentRoot = path.join(tempRoot, "content");
  const workspaceRoot = path.join(tempRoot, "workspace");

  await writeFile(path.join(contentRoot, "campaigns", "alpha.json"), '{"version":1}\n');
  await writeFile(path.join(contentRoot, "src", "package", "template.mis.json"), '{"template":1}\n');
  await writeFile(path.join(contentRoot, "src", "packages", "sample", "quest.cmp.json"), '{"quest":1}\n');
  await writeFile(path.join(contentRoot, "parsers", "parser.txt"), "parser-v1\n");
  await writeFile(path.join(contentRoot, "tests", "fixture.txt"), "fixture-v1\n");

  await ensureWorkspace({ contentRoot, workspaceRoot, appVersion: "0.1.3" });

  await writeFile(path.join(workspaceRoot, "campaigns", "alpha.json"), '{"version":"user-edit"}\n');
  await writeFile(path.join(contentRoot, "parsers", "parser.txt"), "parser-v2\n");
  await writeFile(path.join(contentRoot, "campaigns", "alpha.json"), '{"version":2}\n');

  const result = await ensureWorkspace({ contentRoot, workspaceRoot, appVersion: "0.1.4" });

  assert.equal(
    await fs.readFile(path.join(workspaceRoot, "parsers", "parser.txt"), "utf8"),
    "parser-v2\n"
  );
  assert.equal(
    await fs.readFile(path.join(workspaceRoot, "campaigns", "alpha.json"), "utf8"),
    '{"version":"user-edit"}\n'
  );
  assert.equal(result.refreshed.includes(path.join("parsers", "parser.txt")), true);
  assert.equal(result.skipped.includes(path.join("campaigns", "alpha.json")), true);

  await fs.rm(tempRoot, { recursive: true, force: true });
});
