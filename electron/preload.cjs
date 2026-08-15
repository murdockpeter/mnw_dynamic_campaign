const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mnwDesktop", {
  getDesktopInfo: () => ipcRenderer.invoke("mnw:getDesktopInfo"),
  getWorkflowStatus: (payload) => ipcRenderer.invoke("mnw:getWorkflowStatus", payload),
  loadSettings: () => ipcRenderer.invoke("mnw:loadSettings"),
  saveSettings: (payload) => ipcRenderer.invoke("mnw:saveSettings", payload),
  detectDesktopPaths: () => ipcRenderer.invoke("mnw:detectDesktopPaths"),
  fetchAisContacts: (payload) => ipcRenderer.invoke("mnw:fetchAisContacts", payload),
  loadRuntimeSnapshot: (payload) => ipcRenderer.invoke("mnw:loadRuntimeSnapshot", payload),
  openDesktopGuide: () => ipcRenderer.invoke("mnw:openDesktopGuide"),
  openOperationalMap: (payload) => ipcRenderer.invoke("mnw:openOperationalMap", payload),
  getOperationalMapUrl: (payload) => ipcRenderer.invoke("mnw:getOperationalMapUrl", payload),
  exportRuntime: (payload) => ipcRenderer.invoke("mnw:exportRuntime", payload),
  buildPackage: (payload) => ipcRenderer.invoke("mnw:buildPackage", payload),
  deployPackage: (payload) => ipcRenderer.invoke("mnw:deployPackage", payload),
  ingestResult: (payload) => ipcRenderer.invoke("mnw:ingestResult", payload),
  saveManualResult: (payload) => ipcRenderer.invoke("mnw:saveManualResult", payload),
  loadCampaignControls: (payload) => ipcRenderer.invoke("mnw:loadCampaignControls", payload),
  saveModuleConfig: (payload) => ipcRenderer.invoke("mnw:saveModuleConfig", payload),
  previewMissionResult: (payload) => ipcRenderer.invoke("mnw:previewMissionResult", payload),
  saveCampaignState: (payload) => ipcRenderer.invoke("mnw:saveCampaignState", payload),
  restoreCampaignState: (payload) => ipcRenderer.invoke("mnw:restoreCampaignState", payload),
  exportSupportBundle: (payload) => ipcRenderer.invoke("mnw:exportSupportBundle", payload),
  loadLocalPlatformCatalog: (payload) => ipcRenderer.invoke("mnw:loadLocalPlatformCatalog", payload),
  generateCampaign: (payload) => ipcRenderer.invoke("mnw:generateCampaign", payload),
  continueCampaign: (payload) => ipcRenderer.invoke("mnw:continueCampaign", payload),
  getUpdateState: () => ipcRenderer.invoke("mnw:getUpdateState"),
  checkForUpdates: () => ipcRenderer.invoke("mnw:checkForUpdates"),
  downloadUpdate: () => ipcRenderer.invoke("mnw:downloadUpdate"),
  installUpdate: () => ipcRenderer.invoke("mnw:installUpdate"),
  onUpdateState: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on("mnw:updateState", wrapped);
    return () => ipcRenderer.removeListener("mnw:updateState", wrapped);
  }
});
