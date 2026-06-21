import test from "node:test";
import assert from "node:assert/strict";

import { parseSteamLibraryFolders } from "../portable/lib/desktop-api.mjs";

test("parseSteamLibraryFolders extracts Steam library roots from VDF content", () => {
  const raw = `"libraryfolders"
{
  "0"
  {
    "path"    "C:\\\\Program Files (x86)\\\\Steam"
  }
  "1"
  {
    "path"    "D:\\\\SteamLibrary"
  }
}`;

  assert.deepEqual(parseSteamLibraryFolders(raw), [
    "C:\\Program Files (x86)\\Steam",
    "D:\\SteamLibrary"
  ]);
});

