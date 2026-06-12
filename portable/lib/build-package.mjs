import fs from "node:fs/promises";
import path from "node:path";

import { ensureDir, listFiles, md5Buffer, normalizeZipPath, readJson, writeJson } from "./fs-helpers.mjs";
import { writeStoredZip } from "./zip-store.mjs";

export async function buildPackage({ sourceDir, outputPath }) {
  const resolvedSource = path.resolve(sourceDir);
  const resolvedOutput = path.resolve(outputPath);
  const manifestPath = path.join(resolvedSource, "manifest.json");
  const manifest = await readJson(manifestPath);
  const files = (await listFiles(resolvedSource)).filter((entry) => entry !== manifestPath);

  const contentEntries = [];
  for (const absolutePath of files) {
    const buffer = await fs.readFile(absolutePath);
    contentEntries.push({
      path: normalizeZipPath(resolvedSource, absolutePath),
      hash: md5Buffer(buffer)
    });
  }

  const updatedManifest = {
    version: manifest.version,
    build: manifest.build,
    dv: manifest.dv,
    author: manifest.author,
    content: contentEntries
  };
  await writeJson(manifestPath, updatedManifest);

  const allFiles = await listFiles(resolvedSource);
  const directories = new Set(["/"]);
  for (const absolutePath of allFiles) {
    const relative = normalizeZipPath(resolvedSource, absolutePath);
    const parts = relative.split("/");
    let current = "";
    for (const part of parts.slice(0, -1)) {
      current = current ? `${current}/${part}` : part;
      directories.add(`${current}/`);
    }
  }

  const zipEntries = [];
  for (const directory of [...directories].sort()) {
    zipEntries.push({ name: directory, data: Buffer.alloc(0), directory: true });
  }
  for (const absolutePath of allFiles.sort()) {
    zipEntries.push({
      name: normalizeZipPath(resolvedSource, absolutePath),
      data: await fs.readFile(absolutePath),
      directory: false
    });
  }

  await ensureDir(path.dirname(resolvedOutput));
  await writeStoredZip(resolvedOutput, zipEntries);

  return {
    outputPath: resolvedOutput,
    hash: md5Buffer(await fs.readFile(resolvedOutput)),
    manifest: updatedManifest
  };
}
