const path = require("path");
const { pathToFileURL } = require("url");
const { app, BrowserWindow, ipcMain } = require("electron");

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

ipcMain.handle("mnw:loadSettings", async () => {
  const { loadSettingsForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return loadSettingsForDesktop({ settingsPath: getSettingsPath() });
});

ipcMain.handle("mnw:saveSettings", async (_event, payload) => {
  const { saveSettingsForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return saveSettingsForDesktop({ settingsPath: getSettingsPath(), settings: payload || {} });
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

ipcMain.handle("mnw:generateCampaign", async (_event, payload) => {
  const { generateCampaignForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return generateCampaignForDesktop({
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
