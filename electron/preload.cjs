const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mnwDesktop", {
  getDesktopInfo: () => ipcRenderer.invoke("mnw:getDesktopInfo"),
  loadSettings: () => ipcRenderer.invoke("mnw:loadSettings"),
  saveSettings: (payload) => ipcRenderer.invoke("mnw:saveSettings", payload),
  exportRuntime: (payload) => ipcRenderer.invoke("mnw:exportRuntime", payload),
  buildPackage: (payload) => ipcRenderer.invoke("mnw:buildPackage", payload),
  deployPackage: (payload) => ipcRenderer.invoke("mnw:deployPackage", payload),
  ingestResult: (payload) => ipcRenderer.invoke("mnw:ingestResult", payload),
  generateCampaign: (payload) => ipcRenderer.invoke("mnw:generateCampaign", payload)
});
