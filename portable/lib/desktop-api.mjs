import path from "node:path";

import { buildPackage } from "./build-package.mjs";
import { appendContinuationScenario } from "./continue-campaign.mjs";
import { defaultGamePaths, ensureDir, readJson, repoRoot, writeJson } from "./fs-helpers.mjs";
import { deployPackage } from "./deploy-package.mjs";
import { generateCampaign } from "./generate-campaign.mjs";
import { exportRuntimePayload, ingestMissionResult } from "./runtime.mjs";
import { loadSettings, saveSettings } from "./settings-store.mjs";
import { ensureWorkspace } from "./workspace-bootstrap.mjs";

async function readDesktopSettings(settingsPath) {
  return settingsPath ? loadSettings(settingsPath) : loadSettings("__defaults__.json");
}

async function resolveRoots({ contentRoot, workspaceRoot }) {
  const effectiveContentRoot = contentRoot || repoRoot;
  const effectiveWorkspaceRoot = workspaceRoot || repoRoot;
  await ensureWorkspace({
    contentRoot: effectiveContentRoot,
    workspaceRoot: effectiveWorkspaceRoot
  });
  return {
    contentRoot: effectiveContentRoot,
    workspaceRoot: effectiveWorkspaceRoot
  };
}

function resolveSourceDir(settings, sourceDir) {
  return sourceDir || settings.preferredPackageSourceDir || "";
}

function resolveOutputPath(settings, outputPath) {
  return outputPath || settings.preferredPackageOutputPath || "";
}

export async function getDesktopInfo({ settingsPath, contentRoot, workspaceRoot } = {}) {
  const settings = await readDesktopSettings(settingsPath);
  const roots = await resolveRoots({ contentRoot, workspaceRoot });
  return {
    repoRoot: roots.contentRoot,
    workspaceRoot: roots.workspaceRoot,
    platform: process.platform,
    defaults: defaultGamePaths(),
    settings
  };
}

export async function loadSettingsForDesktop({ settingsPath }) {
  return loadSettings(settingsPath);
}

export async function saveSettingsForDesktop({ settingsPath, settings }) {
  return saveSettings(settingsPath, settings);
}

export async function exportRuntimeSnapshot({ campaignId, outputPath, stateDir, settingsPath, contentRoot, workspaceRoot } = {}) {
  const settings = await readDesktopSettings(settingsPath);
  const roots = await resolveRoots({ contentRoot, workspaceRoot });
  const effectiveCampaignId = campaignId || settings.preferredCampaignId || "silent_meridian";
  const payload = await exportRuntimePayload({ repoRoot: roots.workspaceRoot, campaignId: effectiveCampaignId, stateDir });
  const resolvedOutput = path.resolve(outputPath || path.join(roots.workspaceRoot, "generated", "ui", "runtime.json"));
  await ensureDir(path.dirname(resolvedOutput));
  await writeJson(resolvedOutput, payload);
  return { outputPath: resolvedOutput, payload };
}

export async function loadRuntimeSnapshotForDesktop({ outputPath, contentRoot, workspaceRoot } = {}) {
  const roots = await resolveRoots({ contentRoot, workspaceRoot });
  const resolvedOutput = path.resolve(outputPath || path.join(roots.workspaceRoot, "generated", "ui", "runtime.json"));
  try {
    const payload = await readJson(resolvedOutput);
    return { outputPath: resolvedOutput, payload };
  } catch {
    return null;
  }
}

export async function buildPackageForDesktop({ sourceDir, outputPath, settingsPath, contentRoot, workspaceRoot } = {}) {
  const settings = await readDesktopSettings(settingsPath);
  const roots = await resolveRoots({ contentRoot, workspaceRoot });
  const effectiveSource = resolveSourceDir(settings, sourceDir) || path.join(roots.workspaceRoot, "src", "package");
  const effectiveOutput = resolveOutputPath(settings, outputPath) || path.join(roots.workspaceRoot, "dist", "norwegian_shadow.kyt");
  return buildPackage({ sourceDir: effectiveSource, outputPath: effectiveOutput });
}

export async function deployPackageForDesktop({ packagePath, gameCampaignPath, userCampaignPath, settingsPath, contentRoot, workspaceRoot } = {}) {
  const settings = await readDesktopSettings(settingsPath);
  const roots = await resolveRoots({ contentRoot, workspaceRoot });
  const effectivePackagePath = packagePath || resolveOutputPath(settings, packagePath) || path.join(roots.workspaceRoot, "dist", "norwegian_shadow.kyt");
  return deployPackage({
    packagePath: effectivePackagePath,
    gameCampaignPath: gameCampaignPath || settings.gameCampaignPath,
    userCampaignPath: userCampaignPath || settings.userCampaignPath
  });
}

export async function ingestResultForDesktop({ campaignId, resultPath, stateDir, advanceHours = 24.0, settingsPath, contentRoot, workspaceRoot } = {}) {
  const settings = await readDesktopSettings(settingsPath);
  const roots = await resolveRoots({ contentRoot, workspaceRoot });
  const effectiveCampaignId = campaignId || settings.preferredCampaignId || "silent_meridian";
  const ingest = await ingestMissionResult({ repoRoot: roots.workspaceRoot, campaignId: effectiveCampaignId, resultPath, stateDir, advanceHours });
  const runtime = await exportRuntimeSnapshot({ campaignId: effectiveCampaignId, stateDir, settingsPath, contentRoot: roots.contentRoot, workspaceRoot: roots.workspaceRoot });
  return { ingest, runtime };
}

export async function generateCampaignForDesktop({ spec, dryRun = false, settingsPath, contentRoot, workspaceRoot } = {}) {
  const roots = await resolveRoots({ contentRoot, workspaceRoot });
  const result = await generateCampaign({
    templateRoot: roots.contentRoot,
    workspaceRoot: roots.workspaceRoot,
    spec,
    dryRun
  });
  if (settingsPath && !dryRun) {
    const settings = await readDesktopSettings(settingsPath);
    await saveSettings(settingsPath, {
      ...settings,
      preferredCampaignId: result.blueprint.campaignId,
      preferredPackageId: result.blueprint.campaignId,
      preferredPackageSourceDir: path.join(roots.workspaceRoot, "src", "packages", result.blueprint.campaignId),
      preferredPackageOutputPath: path.join(roots.workspaceRoot, "dist", `${result.blueprint.campaignId}.kyt`),
      firstLaunchComplete: true
    });
  }
  return result;
}

export async function continueCampaignForDesktop({
  campaignId,
  objective,
  riskPosture,
  operationalTempo,
  stateDir,
  settingsPath,
  contentRoot,
  workspaceRoot
} = {}) {
  const settings = await readDesktopSettings(settingsPath);
  const roots = await resolveRoots({ contentRoot, workspaceRoot });
  const effectiveCampaignId = campaignId || settings.preferredCampaignId || "silent_meridian";
  const continuation = await appendContinuationScenario({
    repoRoot: roots.workspaceRoot,
    campaignId: effectiveCampaignId,
    objective,
    riskPosture,
    operationalTempo,
    stateDir
  });
  const sourceDir = continuation.continuation_source_dir || path.join(roots.workspaceRoot, "src", "packages", effectiveCampaignId);
  const outputPath = resolveOutputPath(settings) || path.join(roots.workspaceRoot, "dist", `${effectiveCampaignId}.kyt`);
  const build = await buildPackage({ sourceDir, outputPath });
  let deploy = null;
  if (settings.gameCampaignPath || settings.userCampaignPath) {
    deploy = await deployPackage({
      packagePath: outputPath,
      gameCampaignPath: settings.gameCampaignPath,
      userCampaignPath: settings.userCampaignPath
    });
  }
  const runtime = await exportRuntimeSnapshot({
    campaignId: effectiveCampaignId,
    stateDir,
    settingsPath,
    contentRoot: roots.contentRoot,
    workspaceRoot: roots.workspaceRoot
  });
  return {
    continuation,
    build,
    deploy,
    runtime
  };
}
