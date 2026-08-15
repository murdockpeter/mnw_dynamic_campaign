import fs from "node:fs/promises";
import path from "node:path";

import { copyFile, defaultGamePaths, ensureDir, md5File } from "./fs-helpers.mjs";
import { readZipEntries } from "./zip-store.mjs";

export async function inspectPackageIdentity(packagePath) {
  const entries = await readZipEntries(packagePath);
  const campaignPaths = [...entries.keys()].filter((name) => name.endsWith("/quest.cmp"));
  const campaignIds = campaignPaths.map((name) => name.slice(0, -"/quest.cmp".length));
  const missionIds = [];
  for (const campaignPath of campaignPaths) {
    const script = entries.get(campaignPath).toString("utf8");
    for (const match of script.matchAll(/Mis\("([^"]+)"\)/g)) missionIds.push(match[1]);
    for (const match of script.matchAll(/PipeMission\("([^"]+)"\)/g)) missionIds.push(match[1]);
  }
  return {
    packagePath: path.resolve(packagePath),
    campaignIds: [...new Set(campaignIds)].sort(),
    missionIds: [...new Set(missionIds)].sort()
  };
}

export async function findPackageIdentityCollisions(packagePath, targetDir) {
  const incoming = await inspectPackageIdentity(packagePath);
  const targetPath = path.join(path.resolve(targetDir), path.basename(packagePath));
  const collisions = [];
  let entries = [];
  try { entries = await fs.readdir(targetDir, { withFileTypes: true }); } catch { return { incoming, collisions }; }
  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".kyt") continue;
    const existingPath = path.resolve(targetDir, entry.name);
    if (existingPath.toLowerCase() === targetPath.toLowerCase()) continue;
    try {
      const existing = await inspectPackageIdentity(existingPath);
      const campaigns = incoming.campaignIds.filter((id) => existing.campaignIds.includes(id));
      const missions = incoming.missionIds.filter((id) => existing.missionIds.includes(id));
      if (campaigns.length || missions.length) collisions.push({ existingPath, campaigns, missions });
    } catch (error) {
      collisions.push({ existingPath, unreadable: true, error: error.message, campaigns: [], missions: [] });
    }
  }
  return { incoming, collisions };
}

export async function deployPackage({ packagePath, gameCampaignPath, userCampaignPath, allowIdentityCollisions = false }) {
  const defaults = defaultGamePaths();
  const resolvedPackage = path.resolve(packagePath);
  const packageFileName = path.basename(resolvedPackage);
  const targets = [
    gameCampaignPath === undefined ? defaults.gameCampaignPath : gameCampaignPath,
    userCampaignPath === undefined ? defaults.userCampaignPath : userCampaignPath
  ].filter((value, index, values) => Boolean(value) && values.indexOf(value) === index);

  const deployedPaths = [];
  const preflight = [];
  for (const targetDir of targets) {
    await ensureDir(targetDir);
    const inspection = await findPackageIdentityCollisions(resolvedPackage, targetDir);
    preflight.push({ targetDir, ...inspection });
    const identityCollisions = inspection.collisions.filter((item) => item.campaigns.length || item.missions.length);
    if (identityCollisions.length && !allowIdentityCollisions) {
      const error = new Error(`Deployment blocked: ${identityCollisions.length} other .kyt package(s) contain the same campaign or mission identities in ${targetDir}. Move backups/replacements outside the live campaign directory.`);
      error.code = "PACKAGE_IDENTITY_COLLISION";
      error.collisions = identityCollisions;
      throw error;
    }
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
    hashes,
    preflight
  };
}
