import { generateCampaign } from "./lib/generate-campaign.mjs";
import { repoRoot } from "./lib/fs-helpers.mjs";

function parseArgs(argv) {
  const args = { spec: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const next = argv[i + 1];
    if (key === "--campaign-id") {
      args.spec.campaignId = next;
      i += 1;
    } else if (key === "--title") {
      args.spec.title = next;
      i += 1;
    } else if (key === "--theater") {
      args.spec.theater = next;
      i += 1;
    } else if (key === "--campaign-climate") {
      args.spec.campaignClimate = next;
      args.spec.tone = next;
      i += 1;
    } else if (key === "--tone") {
      args.spec.tone = next;
      args.spec.campaignClimate = next;
      i += 1;
    } else if (key === "--mission-stance") {
      args.spec.missionStance = next;
      args.spec.posture = next;
      i += 1;
    } else if (key === "--mission-type") {
      args.spec.missionType = next;
      i += 1;
    } else if (key === "--posture") {
      args.spec.posture = next;
      args.spec.missionStance = next;
      i += 1;
    } else if (key === "--roe" || key === "--rules-of-engagement") {
      args.spec.roe = next;
      args.spec.rulesOfEngagement = next;
      i += 1;
    } else if (key === "--year") {
      args.spec.year = Number(next);
      i += 1;
    } else if (key === "--scenario-count") {
      args.spec.scenarioCount = Number(next);
      i += 1;
    } else if (key === "--player-name") {
      args.spec.playerName = next;
      i += 1;
    } else if (key === "--dry-run") {
      args.dryRun = true;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const result = await generateCampaign({
  repoRoot,
  spec: args.spec,
  dryRun: Boolean(args.dryRun)
});
console.log(JSON.stringify(result, null, 2));
