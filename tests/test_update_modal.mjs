import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { updateModalPresentation } from "../ui/update-modal.mjs";

const configuredState = {
  supported: true,
  configured: true,
  currentVersion: "0.1.7",
  canCheck: true
};

test("startup updater offers a check or a session-only bypass", () => {
  const presentation = updateModalPresentation(configuredState);
  assert.equal(presentation.visible, true);
  assert.equal(presentation.primaryAction, "check");
  assert.equal(presentation.primaryLabel, "Check For Updates");
  assert.equal(presentation.bypassDisabled, false);
});

test("available startup update exposes the combined download and apply action", () => {
  const presentation = updateModalPresentation({
    ...configuredState,
    status: "available",
    updateAvailable: true,
    availableVersion: "0.1.8"
  });
  assert.equal(presentation.primaryAction, "download");
  assert.equal(presentation.primaryLabel, "Download & Apply Update");
  assert.match(presentation.status, /0\.1\.7/);
  assert.match(presentation.status, /0\.1\.8/);
});

test("download progress blocks bypass until the apply sequence completes", () => {
  const presentation = updateModalPresentation({
    ...configuredState,
    status: "downloading",
    availableVersion: "0.1.8",
    progressPercent: 47.6
  });
  assert.equal(presentation.progressVisible, true);
  assert.equal(presentation.progressPercent, 47.6);
  assert.equal(presentation.primaryDisabled, true);
  assert.equal(presentation.bypassDisabled, true);
});

test("downloaded and current states offer restart or continue respectively", () => {
  const downloaded = updateModalPresentation({
    ...configuredState,
    status: "downloaded",
    updateDownloaded: true,
    downloadedVersion: "0.1.8"
  });
  assert.equal(downloaded.primaryAction, "install");
  assert.equal(downloaded.primaryLabel, "Apply Update & Restart");

  const current = updateModalPresentation({
    ...configuredState,
    status: "idle",
    lastCheckedAt: "2028-01-01T00:00:00Z",
    message: "You are up to date on 0.1.7."
  });
  assert.equal(current.primaryAction, "dismiss");
  assert.equal(current.primaryLabel, "Continue");
});

test("startup updater stays hidden outside configured packaged builds", () => {
  assert.equal(updateModalPresentation({ supported: false, configured: true }).visible, false);
  assert.equal(updateModalPresentation({ supported: true, configured: false }).visible, false);
});

test("packaged updater applies downloads only after explicit approval", async () => {
  const mainSource = await fs.readFile(new URL("../electron/main.cjs", import.meta.url), "utf8");
  assert.match(mainSource, /autoUpdater\.autoInstallOnAppQuit = false/);
  assert.match(mainSource, /void autoUpdater\.checkForUpdates\(\)\.catch/);
});
