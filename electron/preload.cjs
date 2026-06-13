const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mnwDesktop", {
  getDesktopInfo: () => ipcRenderer.invoke("mnw:getDesktopInfo"),
  loadSettings: () => ipcRenderer.invoke("mnw:loadSettings"),
  saveSettings: (payload) => ipcRenderer.invoke("mnw:saveSettings", payload),
  loadRuntimeSnapshot: (payload) => ipcRenderer.invoke("mnw:loadRuntimeSnapshot", payload),
  openDesktopGuide: () => ipcRenderer.invoke("mnw:openDesktopGuide"),
  exportRuntime: (payload) => ipcRenderer.invoke("mnw:exportRuntime", payload),
  buildPackage: (payload) => ipcRenderer.invoke("mnw:buildPackage", payload),
  deployPackage: (payload) => ipcRenderer.invoke("mnw:deployPackage", payload),
  ingestResult: (payload) => ipcRenderer.invoke("mnw:ingestResult", payload),
  saveManualResult: (payload) => ipcRenderer.invoke("mnw:saveManualResult", payload),
  generateCampaign: (payload) => ipcRenderer.invoke("mnw:generateCampaign", payload),
  continueCampaign: (payload) => ipcRenderer.invoke("mnw:continueCampaign", payload)
});
