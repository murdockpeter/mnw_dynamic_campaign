import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import { buildPackage } from "./build-package.mjs";
import { appendContinuationScenario } from "./continue-campaign.mjs";
import { fetchAisContacts } from "./ais-api.mjs";
import { defaultGamePaths, ensureDir, md5File, readJson, repoRoot, writeJson } from "./fs-helpers.mjs";
import { deployPackage } from "./deploy-package.mjs";
import { generateCampaign } from "./generate-campaign.mjs";
import { exportRuntimePayload, ingestMissionResult, ingestMissionResultPayload } from "./runtime.mjs";
import { loadSettings, saveSettings } from "./settings-store.mjs";
import { ensureWorkspace } from "./workspace-bootstrap.mjs";

const execFile = promisify(execFileCallback);

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

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function directoryExists(targetPath) {
  try {
    const stats = await fs.stat(targetPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

function normalizeWindowsPath(value) {
  return String(value || "").trim().replace(/\//g, "\\");
}

async function readWindowsRegistryString(keyPath, valueName) {
  if (process.platform !== "win32") {
    return null;
  }
  try {
    const { stdout } = await execFile("reg", ["query", keyPath, "/v", valueName], { windowsHide: true });
    const match = stdout.match(new RegExp(`${valueName}\\s+REG_\\w+\\s+(.+)$`, "mi"));
    return match ? normalizeWindowsPath(match[1]) : null;
  } catch {
    return null;
  }
}

export function parseSteamLibraryFolders(rawVdf = "") {
  const libraries = [];
  const regex = /"path"\s+"([^"]+)"/g;
  for (const match of rawVdf.matchAll(regex)) {
    const candidate = normalizeWindowsPath(match[1].replace(/\\\\/g, "\\"));
    if (candidate && !libraries.includes(candidate)) {
      libraries.push(candidate);
    }
  }
  return libraries;
}

async function detectSteamLibraries() {
  const libraries = [];
  const pushCandidate = (candidate) => {
    const normalized = normalizeWindowsPath(candidate);
    if (normalized && !libraries.includes(normalized)) {
      libraries.push(normalized);
    }
  };

  pushCandidate(await readWindowsRegistryString("HKCU\\Software\\Valve\\Steam", "SteamPath"));
  pushCandidate(process.env["ProgramFiles(x86)"] ? path.join(process.env["ProgramFiles(x86)"], "Steam") : null);
  pushCandidate(process.env.ProgramFiles ? path.join(process.env.ProgramFiles, "Steam") : null);
  pushCandidate("C:\\Steam");

  for (const steamRoot of [...libraries]) {
    const libraryFile = path.join(steamRoot, "steamapps", "libraryfolders.vdf");
    try {
      const raw = await fs.readFile(libraryFile, "utf8");
      for (const parsed of parseSteamLibraryFolders(raw)) {
        pushCandidate(parsed);
      }
    } catch {
      // Continue with any roots we already have.
    }
  }

  return libraries;
}

async function detectGameCampaignPath() {
  const defaults = defaultGamePaths();
  const defaultCandidate = defaults.gameCampaignPath;
  if (defaultCandidate && await directoryExists(defaultCandidate)) {
    return {
      path: defaultCandidate,
      source: "default_steam_path",
      exists: true
    };
  }

  for (const steamLibrary of await detectSteamLibraries()) {
    const candidate = path.join(steamLibrary, "steamapps", "common", "Modern Naval Warfare", "Var", "Scenarios", "Packages", "Campaigns");
    if (await directoryExists(candidate)) {
      return {
        path: candidate,
        source: "steam_library_scan",
        exists: true
      };
    }
  }

  return {
    path: defaultCandidate || "",
    source: "default_guess",
    exists: Boolean(defaultCandidate)
  };
}

async function detectUserCampaignPath() {
  const defaults = defaultGamePaths();
  const candidates = [
    defaults.userCampaignPath,
    path.join(os.homedir(), "AppData", "LocalLow", "WaveOps", "ModernNavalWarfare", "Scenarios", "Packages", "Campaigns")
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await directoryExists(candidate)) {
      return {
        path: candidate,
        source: "local_profile",
        exists: true
      };
    }
  }

  return {
    path: candidates[0] || "",
    source: "default_guess",
    exists: Boolean(candidates[0])
  };
}

export async function detectDesktopPathsForDesktop({ settingsPath, contentRoot, workspaceRoot } = {}) {
  const settings = await readDesktopSettings(settingsPath);
  const roots = await resolveRoots({ contentRoot, workspaceRoot });
  const preferredCampaignId = settings.preferredCampaignId || "silent_meridian";
  const preferredPackageId = settings.preferredPackageId || preferredCampaignId;
  const gameCampaign = await detectGameCampaignPath();
  const userCampaign = await detectUserCampaignPath();
  const preferredPackageSourceDir = path.join(roots.workspaceRoot, "src", "packages", preferredPackageId);
  const preferredPackageOutputPath = path.join(roots.workspaceRoot, "dist", `${preferredPackageId}.kyt`);
  const findings = [
    gameCampaign.exists
      ? `Game campaign path found via ${gameCampaign.source.replaceAll("_", " ")}.`
      : "Game campaign path not confirmed; using the best default guess.",
    userCampaign.exists
      ? "User campaign path found in the local Windows profile."
      : "User campaign path not confirmed; using the standard LocalLow guess.",
    `Package source and output paths were set from this app's writable workspace for package ID ${preferredPackageId}.`
  ];

  return {
    gameCampaignPath: gameCampaign.path,
    userCampaignPath: userCampaign.path,
    preferredCampaignId,
    preferredPackageId,
    preferredPackageSourceDir,
    preferredPackageOutputPath,
    findings,
    status: {
      gameCampaignFound: gameCampaign.exists,
      userCampaignFound: userCampaign.exists
    }
  };
}

function resolveSourceDir(settings, sourceDir) {
  return sourceDir || settings.preferredPackageSourceDir || "";
}

function resolveOutputPath(settings, outputPath) {
  return outputPath || settings.preferredPackageOutputPath || "";
}

async function safeReadJson(targetPath, fallback = null) {
  try {
    return await readJson(targetPath);
  } catch {
    return fallback;
  }
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

export async function getWorkflowStatusForDesktop({ campaignId, packageId, settingsPath, contentRoot, workspaceRoot, stateDir } = {}) {
  const settings = await readDesktopSettings(settingsPath);
  const roots = await resolveRoots({ contentRoot, workspaceRoot });
  const effectiveCampaignId = campaignId || settings.preferredCampaignId || "silent_meridian";
  const effectivePackageId = packageId || settings.preferredPackageId || effectiveCampaignId;
  const sourceDir = resolveSourceDir(settings) || path.join(roots.workspaceRoot, "src", "packages", effectivePackageId);
  const outputPath = resolveOutputPath(settings) || path.join(roots.workspaceRoot, "dist", `${effectivePackageId}.kyt`);
  const gameDeployPath = settings.gameCampaignPath ? path.join(settings.gameCampaignPath, `${effectivePackageId}.kyt`) : "";
  const userDeployPath = settings.userCampaignPath ? path.join(settings.userCampaignPath, `${effectivePackageId}.kyt`) : "";
  const runtimeSnapshotPath = path.join(roots.workspaceRoot, "generated", "ui", "runtime.json");
  const effectiveStateDir = stateDir || path.join(roots.workspaceRoot, "state");
  const statePath = path.join(effectiveStateDir, effectiveCampaignId, "campaign_state.json");
  const resultPath = path.join(effectiveStateDir, effectiveCampaignId, "mission_results.json");
  const manifestPath = path.join(sourceDir, "manifest.json");
  const questPath = path.join(sourceDir, effectivePackageId, "quest.cmp");

  const setupComplete = Boolean(settings.firstLaunchComplete && settings.gameCampaignPath && settings.userCampaignPath);
  const filesWritten = await pathExists(manifestPath) && await pathExists(questPath);
  const builtPackage = await pathExists(outputPath);
  const builtPackageHash = builtPackage ? await md5File(outputPath) : null;
  const gameDeploymentExists = gameDeployPath ? await pathExists(gameDeployPath) : false;
  const userDeploymentExists = userDeployPath ? await pathExists(userDeployPath) : false;
  const deployedToGame = Boolean(
    builtPackageHash
    && gameDeploymentExists
    && await md5File(gameDeployPath) === builtPackageHash
  );
  const deployedToUser = Boolean(
    builtPackageHash
    && userDeploymentExists
    && await md5File(userDeployPath) === builtPackageHash
  );
  const runtimeSnapshotExported = await pathExists(runtimeSnapshotPath);
  const runtimeStateExists = await pathExists(statePath);
  const missionResults = await safeReadJson(resultPath, []);
  const resultCount = Array.isArray(missionResults) ? missionResults.length : 0;
  const latestResult = resultCount ? missionResults[resultCount - 1] : null;
  const runtimeSnapshot = runtimeSnapshotExported ? await safeReadJson(runtimeSnapshotPath, null) : null;

  const steps = [
    {
      key: "setup",
      label: "Setup Saved",
      state: setupComplete ? "complete" : "pending",
      detail: setupComplete ? "MNW paths and default IDs are saved." : "Save MNW paths and defaults in Setup."
    },
    {
      key: "files",
      label: "Campaign Files Written",
      state: filesWritten ? "complete" : "pending",
      detail: filesWritten ? `Source files exist in ${sourceDir}.` : "Write campaign files from Authoring."
    },
    {
      key: "build",
      label: "Package Built",
      state: builtPackage ? "complete" : "pending",
      detail: builtPackage ? `Built package found at ${outputPath}.` : "Build the package."
    },
    {
      key: "deploy",
      label: "Package Deployed",
      state: (deployedToGame || deployedToUser) ? "complete" : "pending",
      detail: (deployedToGame || deployedToUser)
        ? `Deployment found${deployedToGame ? " in game path" : ""}${deployedToGame && deployedToUser ? " and" : ""}${deployedToUser ? " in user path" : ""}.`
        : (gameDeploymentExists || userDeploymentExists)
          ? "A deployed package exists, but it does not match the current build. Deploy again."
          : "Deploy the package to MNW."
    },
    {
      key: "runtime",
      label: "Runtime Snapshot Exported",
      state: runtimeSnapshotExported ? "complete" : "pending",
      detail: runtimeSnapshotExported ? "Campaign Tracking has a live runtime snapshot." : "Export runtime after the campaign exists in MNW."
    },
    {
      key: "result",
      label: "Mission Result Saved",
      state: resultCount > 0 ? "complete" : "pending",
      detail: resultCount > 0
        ? `${resultCount} mission result${resultCount === 1 ? "" : "s"} saved.${latestResult ? ` Latest outcome: ${latestResult.outcome}.` : ""}`
        : "No saved mission results yet."
    }
  ];

  let recommendation = "Save Setup first.";
  if (setupComplete && !filesWritten) {
    recommendation = "Write campaign files in Authoring.";
  } else if (filesWritten && !builtPackage) {
    recommendation = "Build the package.";
  } else if (builtPackage && !(deployedToGame || deployedToUser)) {
    recommendation = "Deploy the package to MNW.";
  } else if ((deployedToGame || deployedToUser) && !runtimeSnapshotExported) {
    recommendation = "Launch or load the campaign in MNW, then refresh from current campaign state.";
  } else if (runtimeSnapshotExported && resultCount === 0) {
    recommendation = "Play the current mission, then save the mission result in Campaign Tracking.";
  } else if (runtimeSnapshotExported && resultCount > 0) {
    recommendation = "Continue the campaign if you want to append the next mission, or return to MNW to play.";
  }

  return {
    campaignId: effectiveCampaignId,
    packageId: effectivePackageId,
    sourceDir,
    outputPath,
    runtimeSnapshotPath,
    statePath,
    readyToPlay: Boolean((deployedToGame || deployedToUser) && runtimeSnapshotExported),
    deployedToGame,
    deployedToUser,
    runtimeStateExists,
    resultCount,
    latestResult,
    hasRuntimeSnapshot: runtimeSnapshotExported,
    currentMissionId: runtimeSnapshot?.state?.current_mission_id || null,
    recommendation,
    steps
  };
}

export async function loadSettingsForDesktop({ settingsPath }) {
  return loadSettings(settingsPath);
}

export async function saveSettingsForDesktop({ settingsPath, settings }) {
  return saveSettings(settingsPath, settings);
}

export async function fetchAisContactsForDesktop({ center, radiusKm, theaterName, settingsPath } = {}) {
  const settings = await readDesktopSettings(settingsPath);
  const result = await fetchAisContacts({
    settings,
    center,
    radiusKm,
    theaterName
  });
  if (settingsPath && result?.enabled) {
    await saveSettings(settingsPath, {
      ...settings,
      ais: {
        ...(settings.ais || {}),
        latestSample: {
          fetchedAt: new Date().toISOString(),
          provider: result.provider || "aisstream",
          theaterName: result.theaterName || theaterName || null,
          center: result.center || center || null,
          radiusKm: result.radiusKm || radiusKm || settings.ais?.queryRadiusKm || 160,
          contacts: Array.isArray(result.contacts) ? result.contacts : []
        }
      }
    });
  }
  return result;
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

export async function ingestResultPayloadForDesktop({ campaignId, result, stateDir, advanceHours = 24.0, settingsPath, contentRoot, workspaceRoot } = {}) {
  const settings = await readDesktopSettings(settingsPath);
  const roots = await resolveRoots({ contentRoot, workspaceRoot });
  const effectiveCampaignId = campaignId || settings.preferredCampaignId || "silent_meridian";
  const ingest = await ingestMissionResultPayload({
    repoRoot: roots.workspaceRoot,
    campaignId: effectiveCampaignId,
    result,
    stateDir,
    advanceHours
  });
  const runtime = await exportRuntimeSnapshot({
    campaignId: effectiveCampaignId,
    stateDir,
    settingsPath,
    contentRoot: roots.contentRoot,
    workspaceRoot: roots.workspaceRoot
  });
  return { ingest, runtime };
}

export async function generateCampaignForDesktop({ spec, dryRun = false, settingsPath, contentRoot, workspaceRoot } = {}) {
  const settings = settingsPath ? await readDesktopSettings(settingsPath) : {};
  const roots = await resolveRoots({ contentRoot, workspaceRoot });
  const result = await generateCampaign({
    templateRoot: roots.contentRoot,
    workspaceRoot: roots.workspaceRoot,
    spec: {
      ...(spec || {}),
      aisSnapshot: settings?.ais?.latestSample || null
    },
    dryRun
  });
  if (settingsPath && !dryRun) {
    await saveSettings(settingsPath, {
      ...settings,
      preferredCampaignId: result.blueprint.campaignId,
      preferredPackageId: result.blueprint.campaignId,
      preferredPackageSourceDir: path.join(roots.workspaceRoot, "src", "packages", result.blueprint.campaignId),
      preferredPackageOutputPath: path.join(roots.workspaceRoot, "dist", `${result.blueprint.campaignId}.kyt`),
      firstLaunchComplete: true
    });
  }
  if (dryRun) {
    return result;
  }
  const runtime = await exportRuntimeSnapshot({
    campaignId: result.blueprint.campaignId,
    settingsPath,
    contentRoot: roots.contentRoot,
    workspaceRoot: roots.workspaceRoot
  });
  return {
    ...result,
    runtime
  };
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
    stateDir,
    aisSnapshot: settings?.ais?.latestSample || null
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
