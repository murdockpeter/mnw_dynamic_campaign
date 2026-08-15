const path = require("path");
const { pathToFileURL } = require("url");
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { autoUpdater } = require("electron-updater");

let mainWindow = null;
let updaterConfigured = false;
let updaterListenersAttached = false;
let autoCheckAttempted = false;
let updateState = {
  supported: true,
  configured: false,
  provider: null,
  source: "",
  currentVersion: app.getVersion(),
  status: "idle",
  message: "Updates are not configured yet.",
  checking: false,
  updateAvailable: false,
  updateDownloaded: false,
  canCheck: false,
  canDownload: false,
  canInstall: false,
  downloadedVersion: null,
  availableVersion: null,
  lastCheckedAt: null,
  progressPercent: 0,
  error: null
};

function getAppIconPath() {
  return path.join(__dirname, "resources", "icon.png");
}

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

function getDesktopContext(payload = {}) {
  return {
    ...(payload || {}),
    settingsPath: getSettingsPath(),
    contentRoot: getContentRoot(),
    workspaceRoot: getWorkspaceRoot(),
    appVersion: app.getVersion()
  };
}

function publishUpdateState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("mnw:updateState", updateState);
  }
}

function setUpdateState(patch) {
  updateState = {
    ...updateState,
    ...patch
  };
  publishUpdateState();
}

function normalizeUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function resolveUpdateProviderConfig(settings = {}) {
  const updates = settings.updates || {};
  const provider = updates.provider || "generic";

  if (provider === "github") {
    const owner = String(updates.githubOwner || "").trim();
    const repo = String(updates.githubRepo || "").trim();
    if (!owner || !repo) {
      return null;
    }
    return {
      provider: "github",
      owner,
      repo
    };
  }

  const feedUrl = normalizeUrl(updates.feedUrl);
  if (!feedUrl) {
    return null;
  }
  return {
    provider: "generic",
    url: feedUrl
  };
}

function describeUpdateSource(config) {
  if (!config) {
    return "";
  }
  if (config.provider === "github") {
    return `github:${config.owner}/${config.repo}`;
  }
  return config.url || "";
}

function attachUpdaterListeners() {
  if (updaterListenersAttached) {
    return;
  }
  updaterListenersAttached = true;

  autoUpdater.on("checking-for-update", () => {
    setUpdateState({
      status: "checking",
      message: "Checking for updates...",
      checking: true,
      updateAvailable: false,
      canCheck: false,
      canDownload: false,
      canInstall: false,
      error: null,
      progressPercent: 0,
      lastCheckedAt: new Date().toISOString()
    });
  });

  autoUpdater.on("update-available", (info) => {
    setUpdateState({
      status: "available",
      message: `Update ${info?.version || "available"} is ready to download.`,
      checking: false,
      updateAvailable: true,
      updateDownloaded: false,
      availableVersion: info?.version || null,
      downloadedVersion: null,
      canCheck: true,
      canDownload: true,
      canInstall: false,
      error: null,
      progressPercent: 0
    });
  });

  autoUpdater.on("update-not-available", (info) => {
    setUpdateState({
      status: "idle",
      message: `You are up to date on ${info?.version || app.getVersion()}.`,
      checking: false,
      updateAvailable: false,
      updateDownloaded: false,
      availableVersion: info?.version || app.getVersion(),
      downloadedVersion: null,
      canCheck: true,
      canDownload: false,
      canInstall: false,
      error: null,
      progressPercent: 0
    });
  });

  autoUpdater.on("error", (error) => {
    setUpdateState({
      status: "error",
      message: error?.message || "Update check failed.",
      checking: false,
      canCheck: updateState.configured,
      canDownload: false,
      canInstall: false,
      error: error?.message || String(error),
      progressPercent: 0
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    setUpdateState({
      status: "downloading",
      message: `Downloading update... ${Math.round(progress?.percent || 0)}%`,
      checking: false,
      canCheck: false,
      canDownload: false,
      canInstall: false,
      progressPercent: Number(progress?.percent || 0)
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    setUpdateState({
      status: "downloaded",
      message: `Update ${info?.version || "ready"} has been downloaded. Restart to install.`,
      checking: false,
      updateAvailable: true,
      updateDownloaded: true,
      downloadedVersion: info?.version || null,
      availableVersion: info?.version || updateState.availableVersion,
      canCheck: true,
      canDownload: false,
      canInstall: true,
      progressPercent: 100,
      error: null
    });
  });
}

async function loadDesktopSettings() {
  const { loadSettingsForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return loadSettingsForDesktop({ settingsPath: getSettingsPath() });
}

async function configureUpdater(settings) {
  const providerConfig = resolveUpdateProviderConfig(settings);

  if (!app.isPackaged) {
    updaterConfigured = false;
    setUpdateState({
      supported: false,
      configured: Boolean(providerConfig),
      provider: providerConfig?.provider || null,
      source: describeUpdateSource(providerConfig),
      status: "unsupported",
      message: "Auto-update is only available in packaged app builds.",
      canCheck: false,
      canDownload: false,
      canInstall: false
    });
    return;
  }

  if (!providerConfig) {
    updaterConfigured = false;
    setUpdateState({
      supported: true,
      configured: false,
      provider: null,
      source: "",
      status: "idle",
      message: "Set an update source in Setup to enable app updates.",
      canCheck: false,
      canDownload: false,
      canInstall: false,
      checking: false,
      progressPercent: 0,
      error: null
    });
    return;
  }

  attachUpdaterListeners();
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.setFeedURL(providerConfig);
  updaterConfigured = true;
  setUpdateState({
    supported: true,
    configured: true,
    provider: providerConfig.provider,
    source: describeUpdateSource(providerConfig),
    status: updateState.updateDownloaded ? "downloaded" : "idle",
    message: updateState.updateDownloaded
      ? updateState.message
      : "Update source configured. Check for updates when ready.",
    canCheck: true,
    canDownload: false,
    canInstall: updateState.updateDownloaded,
    checking: false,
    error: null
  });

  if (!autoCheckAttempted && settings?.updates?.autoCheckOnLaunch !== false) {
    autoCheckAttempted = true;
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      setUpdateState({
        status: "error",
        message: error?.message || "Update check failed.",
        checking: false,
        canCheck: true,
        error: error?.message || String(error)
      });
    }
  }
}

async function checkForUpdates() {
  if (!updaterConfigured) {
    throw new Error("Updates are not configured yet.");
  }
  await autoUpdater.checkForUpdates();
  return updateState;
}

async function downloadUpdate() {
  if (!updaterConfigured) {
    throw new Error("Updates are not configured yet.");
  }
  await autoUpdater.downloadUpdate();
  return updateState;
}

function installUpdate() {
  if (!updateState.updateDownloaded) {
    throw new Error("No downloaded update is ready to install.");
  }
  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true);
  });
  return {
    ...updateState,
    message: "Restarting to install update."
  };
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1520,
    height: 980,
    minWidth: 1180,
    minHeight: 780,
    icon: getAppIconPath(),
    backgroundColor: "#07131d",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await window.loadFile(path.join(__dirname, "..", "ui", "index.html"));
  mainWindow = window;
  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });
}

ipcMain.handle("mnw:getDesktopInfo", async () => {
  const { getDesktopInfo } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return getDesktopInfo(getDesktopContext());
});

ipcMain.handle("mnw:getWorkflowStatus", async (_event, payload) => {
  const { getWorkflowStatusForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return getWorkflowStatusForDesktop(getDesktopContext(payload));
});

ipcMain.handle("mnw:loadSettings", async () => {
  return loadDesktopSettings();
});

ipcMain.handle("mnw:saveSettings", async (_event, payload) => {
  const { saveSettingsForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  const saved = await saveSettingsForDesktop({ settingsPath: getSettingsPath(), settings: payload || {} });
  await configureUpdater(saved);
  return saved;
});

ipcMain.handle("mnw:detectDesktopPaths", async () => {
  const { detectDesktopPathsForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return detectDesktopPathsForDesktop(getDesktopContext());
});

ipcMain.handle("mnw:fetchAisContacts", async (_event, payload) => {
  const { fetchAisContactsForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return fetchAisContactsForDesktop({ ...(payload || {}), settingsPath: getSettingsPath() });
});

ipcMain.handle("mnw:loadRuntimeSnapshot", async (_event, payload) => {
  const { loadRuntimeSnapshotForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return loadRuntimeSnapshotForDesktop(getDesktopContext(payload));
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
  return exportRuntimeSnapshot(getDesktopContext(payload));
});

ipcMain.handle("mnw:buildPackage", async (_event, payload) => {
  const { buildPackageForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return buildPackageForDesktop(getDesktopContext(payload));
});

ipcMain.handle("mnw:deployPackage", async (_event, payload) => {
  const { deployPackageForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return deployPackageForDesktop(getDesktopContext(payload));
});

ipcMain.handle("mnw:ingestResult", async (_event, payload) => {
  const { ingestResultForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return ingestResultForDesktop(getDesktopContext(payload));
});

ipcMain.handle("mnw:saveManualResult", async (_event, payload) => {
  const { ingestResultPayloadForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return ingestResultPayloadForDesktop(getDesktopContext(payload));
});

ipcMain.handle("mnw:loadCampaignControls", async (_event, payload) => {
  const { loadCampaignControlsForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return loadCampaignControlsForDesktop(getDesktopContext(payload));
});

ipcMain.handle("mnw:saveModuleConfig", async (_event, payload) => {
  const { saveModuleConfigForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return saveModuleConfigForDesktop(getDesktopContext(payload));
});

ipcMain.handle("mnw:previewMissionResult", async (_event, payload) => {
  const { previewMissionResultForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return previewMissionResultForDesktop(getDesktopContext(payload));
});

ipcMain.handle("mnw:saveCampaignState", async (_event, payload) => {
  const { saveCampaignStateForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return saveCampaignStateForDesktop(getDesktopContext(payload));
});

ipcMain.handle("mnw:restoreCampaignState", async (_event, payload) => {
  const { restoreCampaignStateForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return restoreCampaignStateForDesktop(getDesktopContext(payload));
});

ipcMain.handle("mnw:exportSupportBundle", async (_event, payload) => {
  const { exportSupportBundleForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return exportSupportBundleForDesktop(getDesktopContext(payload));
});

ipcMain.handle("mnw:loadLocalPlatformCatalog", async () => {
  const { loadLocalPlatformCatalogForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return loadLocalPlatformCatalogForDesktop(getDesktopContext());
});

ipcMain.handle("mnw:generateCampaign", async (_event, payload) => {
  const { generateCampaignForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return generateCampaignForDesktop(getDesktopContext(payload));
});

ipcMain.handle("mnw:continueCampaign", async (_event, payload) => {
  const { continueCampaignForDesktop } = await loadPortableModule("portable/lib/desktop-api.mjs");
  return continueCampaignForDesktop(getDesktopContext(payload));
});

ipcMain.handle("mnw:getUpdateState", async () => updateState);

ipcMain.handle("mnw:checkForUpdates", async () => checkForUpdates());

ipcMain.handle("mnw:downloadUpdate", async () => downloadUpdate());

ipcMain.handle("mnw:installUpdate", async () => installUpdate());

app.whenReady().then(async () => {
  if (process.argv.includes("--smoke-test")) {
    try {
      const desktopModule = await loadPortableModule("portable/lib/desktop-api.mjs");
      if (typeof desktopModule.getDesktopInfo !== "function" || typeof desktopModule.saveCampaignStateForDesktop !== "function") {
        throw new Error("Packaged desktop API exports are incomplete.");
      }
      app.exit(0);
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
    return;
  }
  const settings = await loadDesktopSettings();
  await configureUpdater(settings);
  await createWindow();
  publishUpdateState();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
      publishUpdateState();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
