import path from "node:path";

import { copyDirIfMissing, ensureDir } from "./fs-helpers.mjs";

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

export async function ensureWorkspace({ contentRoot, workspaceRoot }) {
  if (!contentRoot || !workspaceRoot || contentRoot === workspaceRoot) {
    return {
      workspaceRoot,
      seeded: []
    };
  }

  const seeded = [];
  for (const relativeDir of SEEDED_DIRS) {
    const copied = await copyDirIfMissing(
      path.join(contentRoot, relativeDir),
      path.join(workspaceRoot, relativeDir)
    );
    if (copied) {
      seeded.push(relativeDir);
    }
  }

  for (const relativeDir of EMPTY_DIRS) {
    await ensureDir(path.join(workspaceRoot, relativeDir));
  }

  return {
    workspaceRoot,
    seeded
  };
}
