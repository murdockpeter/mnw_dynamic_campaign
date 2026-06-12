import { ingestMissionResult } from "./lib/runtime.mjs";
import { repoRoot } from "./lib/fs-helpers.mjs";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const next = argv[i + 1];
    if (key === "--campaign-id") {
      args.campaignId = next;
      i += 1;
    } else if (key === "--result") {
      args.resultPath = next;
      i += 1;
    } else if (key === "--state-dir") {
      args.stateDir = next;
      i += 1;
    } else if (key === "--advance-hours") {
      args.advanceHours = Number(next);
      i += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.resultPath) {
  throw new Error("--result is required");
}

const result = await ingestMissionResult({
  repoRoot,
  campaignId: args.campaignId || "silent_meridian",
  resultPath: args.resultPath,
  stateDir: args.stateDir,
  advanceHours: Number.isFinite(args.advanceHours) ? args.advanceHours : 24.0
});
console.log(JSON.stringify(result, null, 2));
