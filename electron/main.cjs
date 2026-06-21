const path = require("path");
const { pathToFileURL } = require("url");
const { app, BrowserWindow, ipcMain, shell } = require("electron");

function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function getContentRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "seed")
    : path.join(__dirname, "..");
}

function getWorkspaceRoot() {
  return app.isPackaged
    ? path.join(app.getPath("userData"), "workspace")
    : getContentRoot();
}

function getDesktopGuidePath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "docs", "DESKTOP_APP_GUIDE.md")
    : path.join(__dirname, "..", "DESKTOP_APP_GUIDE.md");
}

function getDocsPath(relativeName) {
  return app.isPackaged
    ? path.join(process.resourcesPath, "docs", relativeName)
    : path.join(__dirname, "..", "docs", relativeName);
}

async function loadPortableModule(modulePath) {
  return import(pathToFileURL(path.join(__dirname, "..", modulePath)).href);
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1520,
    height: 980,
    minWidth: 1180,
    minHeight: 780,
    backgroundColor: "#07131d",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await window.loadFile(path.join(__dirname, "..", "ui", "index.html"));
}

ipcMain.handle("mnw:getDesktopInfo", async () => {
  const { getDesktopInfo } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return getDesktopInfo({
    settingsPath: getSettingsPath(),
    contentRoot: getContentRoot(),
    workspaceRoot: getWorkspaceRoot()
  });
});

ipcMain.handle("mnw:getWorkflowStatus", async (_event, payload) => {
  const { getWorkflowStatusForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return getWorkflowStatusForDesktop({
    ...(payload || {}),
    settingsPath: getSettingsPath(),
    contentRoot: getContentRoot(),
    workspaceRoot: getWorkspaceRoot()
  });
});

ipcMain.handle("mnw:loadSettings", async () => {
  const { loadSettingsForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return loadSettingsForDesktop({ settingsPath: getSettingsPath() });
});

ipcMain.handle("mnw:saveSettings", async (_event, payload) => {
  const { saveSettingsForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return saveSettingsForDesktop({ settingsPath: getSettingsPath(), settings: payload || {} });
});

ipcMain.handle("mnw:detectDesktopPaths", async () => {
  const { detectDesktopPathsForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return detectDesktopPathsForDesktop({
    settingsPath: getSettingsPath(),
    contentRoot: getContentRoot(),
    workspaceRoot: getWorkspaceRoot()
  });
});

ipcMain.handle("mnw:fetchAisContacts", async (_event, payload) => {
  const { fetchAisContactsForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return fetchAisContactsForDesktop({ ...(payload || {}), settingsPath: getSettingsPath() });
});

ipcMain.handle("mnw:loadRuntimeSnapshot", async (_event, payload) => {
  const { loadRuntimeSnapshotForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return loadRuntimeSnapshotForDesktop({
    ...(payload || {}),
    contentRoot: getContentRoot(),
    workspaceRoot: getWorkspaceRoot()
  });
});

ipcMain.handle("mnw:openDesktopGuide", async () => {
  const guidePath = getDesktopGuidePath();
  return shell.openPath(guidePath);
});

ipcMain.handle("mnw:openOperationalMap", async (_event, payload) => {
  const relativeName = payload?.relativeName;
  if (!relativeName) {
    return "No operational map path was provided.";
  }
  const targetPath = getDocsPath(relativeName);
  return shell.openPath(targetPath);
});

ipcMain.handle("mnw:getOperationalMapUrl", async (_event, payload) => {
  const relativeName = payload?.relativeName;
  if (!relativeName) {
    return null;
  }
  return pathToFileURL(getDocsPath(relativeName)).href;
});

ipcMain.handle("mnw:exportRuntime", async (_event, payload) => {
  const { exportRuntimeSnapshot } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return exportRuntimeSnapshot({
    ...(payload || {}),
    settingsPath: getSettingsPath(),
    contentRoot: getContentRoot(),
    workspaceRoot: getWorkspaceRoot()
  });
});

ipcMain.handle("mnw:buildPackage", async (_event, payload) => {
  const { buildPackageForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return buildPackageForDesktop({
    ...(payload || {}),
    settingsPath: getSettingsPath(),
    contentRoot: getContentRoot(),
    workspaceRoot: getWorkspaceRoot()
  });
});

ipcMain.handle("mnw:deployPackage", async (_event, payload) => {
  const { deployPackageForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return deployPackageForDesktop({
    ...(payload || {}),
    settingsPath: getSettingsPath(),
    contentRoot: getContentRoot(),
    workspaceRoot: getWorkspaceRoot()
  });
});

ipcMain.handle("mnw:ingestResult", async (_event, payload) => {
  const { ingestResultForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return ingestResultForDesktop({
    ...(payload || {}),
    settingsPath: getSettingsPath(),
    contentRoot: getContentRoot(),
    workspaceRoot: getWorkspaceRoot()
  });
});

ipcMain.handle("mnw:saveManualResult", async (_event, payload) => {
  const { ingestResultPayloadForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return ingestResultPayloadForDesktop({
    ...(payload || {}),
    settingsPath: getSettingsPath(),
    contentRoot: getContentRoot(),
    workspaceRoot: getWorkspaceRoot()
  });
});

ipcMain.handle("mnw:generateCampaign", async (_event, payload) => {
  const { generateCampaignForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return generateCampaignForDesktop({
    ...(payload || {}),
    settingsPath: getSettingsPath(),
    contentRoot: getContentRoot(),
    workspaceRoot: getWorkspaceRoot()
  });
});

ipcMain.handle("mnw:continueCampaign", async (_event, payload) => {
  const { continueCampaignForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return continueCampaignForDesktop({
    ...(payload || {}),
    settingsPath: getSettingsPath(),
    contentRoot: getContentRoot(),
    workspaceRoot: getWorkspaceRoot()
  });
});

app.whenReady().then(async () => {
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
