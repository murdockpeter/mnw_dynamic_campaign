import path from "node:path";

import { buildPackage } from "./lib/build-package.mjs";
import { repoRoot } from "./lib/fs-helpers.mjs";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const next = argv[i + 1];
    if (key === "--source-dir") {
      args.sourceDir = next;
      i += 1;
    } else if (key === "--output-path") {
      args.outputPath = next;
      i += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const result = await buildPackage({
  sourceDir: args.sourceDir || path.join(repoRoot, "src", "package"),
  outputPath: args.outputPath || path.join(repoRoot, "dist", "norwegian_shadow.kyt")
});
console.log(JSON.stringify(result, null, 2));
