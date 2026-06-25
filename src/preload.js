const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("airbar", {
  getSnapshot: () => ipcRenderer.invoke("codex:getSnapshot"),
  openProject: (workspacePath) => ipcRenderer.invoke("codex:openProject", workspacePath),
  openProjectFolder: (workspacePath) => ipcRenderer.invoke("app:openProjectFolder", workspacePath),
  minimize: () => ipcRenderer.invoke("app:minimize"),
  getAlwaysOnTop: () => ipcRenderer.invoke("app:getAlwaysOnTop"),
  setAlwaysOnTop: (value) => ipcRenderer.invoke("app:setAlwaysOnTop", value),
  close: () => ipcRenderer.invoke("app:close"),
  openLogs: () => ipcRenderer.invoke("app:openLogs"),
  notify: (payload) => ipcRenderer.invoke("app:notify", payload)
});
