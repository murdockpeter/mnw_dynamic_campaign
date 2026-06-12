import path from "node:path";

import { buildGeneratedCampaignFiles } from "./generated-campaign-files.mjs";
import { ensureDir, writeText } from "./fs-helpers.mjs";

export async function generateCampaign({ templateRoot, workspaceRoot, spec, dryRun = false }) {
  const { blueprint, packageFiles, campaignFiles } = await buildGeneratedCampaignFiles({ templateRoot, spec });
  const packageRoot = path.join(workspaceRoot, "src", "packages", blueprint.campaignId);
  const campaignRoot = path.join(workspaceRoot, "campaigns", blueprint.campaignId);

  if (!dryRun) {
    await ensureDir(packageRoot);
    await ensureDir(campaignRoot);

    for (const [relativePath, content] of Object.entries(packageFiles)) {
      await writeText(path.join(packageRoot, relativePath), content);
    }
    for (const [relativePath, content] of Object.entries(campaignFiles)) {
      await writeText(path.join(campaignRoot, relativePath), content);
    }
  }

  return {
    blueprint,
    packageRoot,
    campaignRoot,
    dryRun
  };
}
