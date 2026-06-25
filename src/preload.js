const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("airbar", {
  getSnapshot: () => ipcRenderer.invoke("codex:getSnapshot"),
  minimize: () => ipcRenderer.invoke("app:minimize"),
  close: () => ipcRenderer.invoke("app:close"),
  openLogs: () => ipcRenderer.invoke("app:openLogs"),
  notify: (payload) => ipcRenderer.invoke("app:notify", payload)
});
