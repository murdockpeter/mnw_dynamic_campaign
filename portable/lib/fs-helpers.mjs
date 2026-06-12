import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function ensureDir(targetPath) {
  await fs.mkdir(targetPath, { recursive: true });
}

export async function readJson(targetPath) {
  const raw = await fs.readFile(targetPath, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

export async function writeJson(targetPath, payload) {
  await ensureDir(path.dirname(targetPath));
  await fs.writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export async function writeText(targetPath, content) {
  await ensureDir(path.dirname(targetPath));
  await fs.writeFile(targetPath, content, "utf8");
}

export async function copyFile(sourcePath, targetPath) {
  await ensureDir(path.dirname(targetPath));
  await fs.copyFile(sourcePath, targetPath);
}

export async function copyDirIfMissing(sourceDir, targetDir) {
  let copiedAny = false;

  async function copyRecursive(currentSource, currentTarget) {
    await ensureDir(currentTarget);
    const entries = await fs.readdir(currentSource, { withFileTypes: true });
    for (const entry of entries) {
      const nextSource = path.join(currentSource, entry.name);
      const nextTarget = path.join(currentTarget, entry.name);
      if (entry.isDirectory()) {
        await copyRecursive(nextSource, nextTarget);
      } else if (entry.isFile()) {
        try {
          await fs.access(nextTarget);
        } catch {
          await copyFile(nextSource, nextTarget);
          copiedAny = true;
        }
      }
    }
  }

  await copyRecursive(sourceDir, targetDir);
  return copiedAny;
}

export function md5Buffer(buffer) {
  return crypto.createHash("md5").update(buffer).digest("hex");
}

export async function md5File(targetPath) {
  const buffer = await fs.readFile(targetPath);
  return md5Buffer(buffer);
}

export async function listFiles(rootDir) {
  const entries = [];

  async function walk(currentDir) {
    const children = await fs.readdir(currentDir, { withFileTypes: true });
    for (const child of children) {
      const absolute = path.join(currentDir, child.name);
      if (child.isDirectory()) {
        await walk(absolute);
      } else if (child.isFile()) {
        entries.push(absolute);
      }
    }
  }

  await walk(rootDir);
  return entries.sort();
}

export function normalizeZipPath(rootDir, absolutePath) {
  return path.relative(rootDir, absolutePath).split(path.sep).join("/");
}

export function defaultGamePaths() {
  if (process.platform === "win32") {
    return {
      gameCampaignPath: "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Modern Naval Warfare\\Var\\Scenarios\\Packages\\Campaigns",
      userCampaignPath: path.join(os.homedir(), "AppData", "LocalLow", "WaveOps", "ModernNavalWarfare", "Scenarios", "Packages", "Campaigns")
    };
  }

  if (process.platform === "darwin") {
    return {
      gameCampaignPath: path.join(os.homedir(), "Library", "Application Support", "Steam", "steamapps", "common", "Modern Naval Warfare", "Var", "Scenarios", "Packages", "Campaigns"),
      userCampaignPath: path.join(os.homedir(), "Library", "Application Support", "WaveOps", "ModernNavalWarfare", "Scenarios", "Packages", "Campaigns")
    };
  }

  return {
    gameCampaignPath: "",
    userCampaignPath: ""
  };
}
