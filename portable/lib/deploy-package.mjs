import path from "node:path";

import { copyFile, defaultGamePaths, ensureDir, md5File } from "./fs-helpers.mjs";

export async function deployPackage({ packagePath, gameCampaignPath, userCampaignPath }) {
  const defaults = defaultGamePaths();
  const resolvedPackage = path.resolve(packagePath);
  const packageFileName = path.basename(resolvedPackage);
  const targets = [
    gameCampaignPath || defaults.gameCampaignPath,
    userCampaignPath || defaults.userCampaignPath
  ].filter(Boolean);

  const deployedPaths = [];
  for (const targetDir of targets) {
    await ensureDir(targetDir);
    const targetPath = path.join(targetDir, packageFileName);
    await copyFile(resolvedPackage, targetPath);
    deployedPaths.push(targetPath);
  }

  const hashes = {};
  hashes[resolvedPackage] = await md5File(resolvedPackage);
  for (const deployedPath of deployedPaths) {
    hashes[deployedPath] = await md5File(deployedPath);
  }

  return {
    packagePath: resolvedPackage,
    deployedPaths,
    hashes
  };
}
