import fs from "node:fs/promises";
import path from "node:path";

import { copyDirIfMissing, copyFile, ensureDir, md5File, readJson, writeJson } from "./fs-helpers.mjs";

const SEEDED_DIRS = [
  "campaigns",
  path.join("src", "package"),
  path.join("src", "packages"),
  "parsers",
  "tests"
];

const EMPTY_DIRS = [
  "dist",
  "generated",
  path.join("generated", "ui"),
  "state"
];

const SEED_MANIFEST_NAME = ".mnw-seed-manifest.json";

function createEmptyManifest(appVersion) {
  return {
    appVersion: appVersion || "unknown",
    files: {}
  };
}

async function loadSeedManifest(workspaceRoot) {
  try {
    return await readJson(path.join(workspaceRoot, SEED_MANIFEST_NAME));
  } catch {
    return null;
  }
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function syncSeededDir({
  relativeDir,
  sourceRoot,
  workspaceRoot,
  previousManifest,
  nextManifest,
  copied,
  refreshed,
  skipped
}) {
  async function walk(currentSourceDir, currentTargetDir) {
    await ensureDir(currentTargetDir);
    const entries = await fs.readdir(currentSourceDir, { withFileTypes: true });
    for (const entry of entries) {
      const sourcePath = path.join(currentSourceDir, entry.name);
      const targetPath = path.join(currentTargetDir, entry.name);
      if (entry.isDirectory()) {
        await walk(sourcePath, targetPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      const relativePath = path.join(relativeDir, path.relative(sourceRoot, sourcePath));
      const sourceHash = await md5File(sourcePath);
      const previousRecord = previousManifest?.files?.[relativePath] || null;
      nextManifest.files[relativePath] = {
        hash: sourceHash
      };

      if (!await pathExists(targetPath)) {
        await copyFile(sourcePath, targetPath);
        copied.push(relativePath);
        continue;
      }

      const targetHash = await md5File(targetPath);
      if (targetHash === sourceHash) {
        continue;
      }

      if (previousRecord?.hash && previousRecord.hash === targetHash) {
        await copyFile(sourcePath, targetPath);
        refreshed.push(relativePath);
        continue;
      }

      skipped.push(relativePath);
    }
  }

  await walk(sourceRoot, path.join(workspaceRoot, relativeDir));
}

export async function ensureWorkspace({ contentRoot, workspaceRoot, appVersion } = {}) {
  if (!contentRoot || !workspaceRoot || contentRoot === workspaceRoot) {
    return {
      workspaceRoot,
      seeded: [],
      refreshed: [],
      skipped: []
    };
  }

  const seeded = [];
  const refreshed = [];
  const skipped = [];
  const previousManifest = await loadSeedManifest(workspaceRoot);
  const nextManifest = createEmptyManifest(appVersion);
  for (const relativeDir of SEEDED_DIRS) {
    const sourceRoot = path.join(contentRoot, relativeDir);
    if (previousManifest) {
      await syncSeededDir({
        relativeDir,
        sourceRoot,
        workspaceRoot,
        previousManifest,
        nextManifest,
        copied: seeded,
        refreshed,
        skipped
      });
    } else {
      const copied = await copyDirIfMissing(
        sourceRoot,
        path.join(workspaceRoot, relativeDir)
      );
      if (copied) {
        seeded.push(relativeDir);
      }
      await syncSeededDir({
        relativeDir,
        sourceRoot,
        workspaceRoot,
        previousManifest: null,
        nextManifest,
        copied: [],
        refreshed: [],
        skipped: []
      });
    }
  }

  for (const relativeDir of EMPTY_DIRS) {
    await ensureDir(path.join(workspaceRoot, relativeDir));
  }

  await writeJson(path.join(workspaceRoot, SEED_MANIFEST_NAME), nextManifest);

  return {
    workspaceRoot,
    seeded,
    refreshed,
    skipped
  };
}
