import fs from "node:fs/promises";
import path from "node:path";

import { decode } from "@msgpack/msgpack";

import { readZipEntry } from "./zip-store.mjs";

const CATEGORY_ENTRIES = Object.freeze({
  submarines: "submarines.msg",
  ships: "ships.msg",
  aircraft: "aircrafts.msg"
});

function objectEntries(value) {
  return value instanceof Map ? [...value.entries()] : Object.entries(value || {});
}

function allTags(row = []) {
  return row.flatMap((value) => Array.isArray(value) ? value : [])
    .filter((value) => typeof value === "string" && value.includes("/"));
}

function inferFaction(tags = [], name = "") {
  const prefix = tags.map((tag) => tag.split("/")[0].toLowerCase());
  if (prefix.includes("usn")) return "US";
  if (prefix.includes("plan")) return "CN";
  if (prefix.includes("mmf")) return "RU";
  if (prefix.includes("civilian")) return "CIV";
  if (/\b(uss|usns)\b/i.test(name)) return "US";
  return "UNKNOWN";
}

function inferRole(category, platformName, tags = []) {
  const haystack = `${platformName} ${tags.join(" ")}`.toLowerCase();
  if (category === "submarines") return "subsurface_combatant";
  if (category === "ships") {
    if (haystack.includes("civilian") || /cargo|tanker|container|merchant/.test(haystack)) return "merchant";
    return "surface_combatant";
  }
  if (/z-9|seahawk|ka-2|helicopter|rotorwing/.test(haystack)) return "asw_helicopter";
  if (/p-8|poseidon|orion|maritime/.test(haystack)) return "maritime_patrol_aircraft";
  return "aircraft";
}

function findIntroYear(row = []) {
  return row.find((value) => Number.isInteger(value) && value >= 1900 && value <= 2100) || null;
}

export function deriveDbDirFromCampaignPath(gameCampaignPath = "") {
  if (!gameCampaignPath) return "";
  return path.resolve(gameCampaignPath, "..", "..", "..", "DB");
}

export async function findCoreDbArchive(dbDir) {
  const entries = await fs.readdir(dbDir, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".core") continue;
    const archivePath = path.join(dbDir, entry.name);
    const stats = await fs.stat(archivePath);
    candidates.push({ archivePath, modifiedMs: stats.mtimeMs, size: stats.size });
  }
  candidates.sort((left, right) => right.modifiedMs - left.modifiedMs);
  if (!candidates.length) throw new Error(`No MNW .core database archive found in ${dbDir}.`);
  return candidates[0];
}

export async function buildLocalPlatformCatalog({ dbDir, gameCampaignPath } = {}) {
  const resolvedDbDir = dbDir || deriveDbDirFromCampaignPath(gameCampaignPath);
  if (!resolvedDbDir) throw new Error("Configure the MNW game campaign path before indexing the local database.");
  const archive = await findCoreDbArchive(resolvedDbDir);
  const namesBuffer = await readZipEntry(archive.archivePath, "element_names.msg");
  if (!namesBuffer) throw new Error("The MNW core database does not contain element_names.msg.");
  const names = decode(namesBuffer);
  const hullsByPlatform = new Map();
  for (const [rawHullId, row] of objectEntries(names)) {
    if (!Array.isArray(row) || row.length < 5) continue;
    const platformId = Number(row[4]);
    if (!hullsByPlatform.has(platformId)) hullsByPlatform.set(platformId, []);
    hullsByPlatform.get(platformId).push({
      dbid: Number(rawHullId),
      name: String(row[1] || `DBID ${rawHullId}`),
      hullNumber: String(row[2] || ""),
      boardNumber: String(row[3] || ""),
      tags: Array.isArray(row[12]) ? row[12] : []
    });
  }

  const platforms = [];
  const units = [];
  for (const [category, entryName] of Object.entries(CATEGORY_ENTRIES)) {
    const buffer = await readZipEntry(archive.archivePath, entryName);
    if (!buffer) continue;
    for (const [rawPlatformId, row] of objectEntries(decode(buffer))) {
      if (!Array.isArray(row) || row.length < 4) continue;
      const platformId = Number(rawPlatformId);
      const platformName = String(row[1] || `Platform ${platformId}`);
      const tags = allTags(row).filter((tag) => !tag.startsWith(`${category}/`) && !tag.startsWith("aircrafts/") && !tag.startsWith("ships/") && !tag.startsWith("submarines/"));
      const faction = inferFaction(tags, platformName);
      const role = inferRole(category, platformName, tags);
      const introYear = findIntroYear(row);
      const hulls = (hullsByPlatform.get(platformId) || []).sort((left, right) => left.dbid - right.dbid);
      const platform = { platformId, platformName, category, faction, role, introYear, tags, hullCount: hulls.length };
      platforms.push(platform);
      const selectableUnits = hulls.length ? hulls : [{
        dbid: platformId,
        name: platformName,
        hullNumber: "",
        boardNumber: "",
        tags
      }];
      for (const hull of selectableUnits) {
        units.push({ ...hull, platformId, platformName, category, faction: faction === "UNKNOWN" ? inferFaction(hull.tags, hull.name) : faction, role, introYear, namedHull: hulls.length > 0 });
      }
    }
  }
  platforms.sort((left, right) => left.platformName.localeCompare(right.platformName));
  units.sort((left, right) => left.name.localeCompare(right.name));
  return {
    schemaVersion: 1,
    indexedAt: new Date().toISOString(),
    source: {
      archiveName: path.basename(archive.archivePath),
      modifiedMs: archive.modifiedMs,
      size: archive.size
    },
    platforms,
    units
  };
}

export function filterPlatformCatalog(catalog, filters = {}) {
  const year = Number(filters.year || 0);
  const factions = new Set((filters.factions || []).map(String));
  const roles = new Set((filters.roles || []).map(String));
  const categories = new Set((filters.categories || []).map(String));
  return (catalog?.units || []).filter((unit) => {
    if (year && unit.introYear && unit.introYear > year) return false;
    if (factions.size && !factions.has(unit.faction)) return false;
    if (roles.size && !roles.has(unit.role)) return false;
    if (categories.size && !categories.has(unit.category)) return false;
    return true;
  });
}
