import path from "node:path";

import { deployPackage } from "./lib/deploy-package.mjs";
import { repoRoot } from "./lib/fs-helpers.mjs";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const next = argv[i + 1];
    if (key === "--package-path") {
      args.packagePath = next;
      i += 1;
    } else if (key === "--game-campaign-path") {
      args.gameCampaignPath = next;
      i += 1;
    } else if (key === "--user-campaign-path") {
      args.userCampaignPath = next;
      i += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const result = await deployPackage({
  packagePath: args.packagePath || path.join(repoRoot, "dist", "norwegian_shadow.kyt"),
  gameCampaignPath: args.gameCampaignPath,
  userCampaignPath: args.userCampaignPath
});
console.log(JSON.stringify(result, null, 2));
