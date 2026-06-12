import path from "node:path";

import { exportRuntimePayload } from "./lib/runtime.mjs";
import { ensureDir, repoRoot, writeJson } from "./lib/fs-helpers.mjs";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const next = argv[i + 1];
    if (key === "--campaign-id") {
      args.campaignId = next;
      i += 1;
    } else if (key === "--output") {
      args.output = next;
      i += 1;
    } else if (key === "--state-dir") {
      args.stateDir = next;
      i += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const payload = await exportRuntimePayload({
  repoRoot,
  campaignId: args.campaignId || "silent_meridian",
  stateDir: args.stateDir
});
const outputPath = path.resolve(args.output || path.join(repoRoot, "generated", "ui", "runtime.json"));
await ensureDir(path.dirname(outputPath));
await writeJson(outputPath, payload);
console.log(outputPath);
