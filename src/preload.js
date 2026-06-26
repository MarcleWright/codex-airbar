const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("airbar", {
  getSnapshot: () => ipcRenderer.invoke("codex:getSnapshot"),
  openProject: (workspacePath) => ipcRenderer.invoke("codex:openProject", workspacePath),
  resumeSession: (sessionId, workspacePath) => ipcRenderer.invoke("codex:resumeSession", sessionId, workspacePath),
  openProjectFolder: (workspacePath) => ipcRenderer.invoke("app:openProjectFolder", workspacePath),
  minimize: () => ipcRenderer.invoke("app:minimize"),
  snapTopCenter: () => ipcRenderer.invoke("app:snapTopCenter"),
  isTopCenterSnapped: () => ipcRenderer.invoke("app:isTopCenterSnapped"),
  onSnapTopCenterStateChanged: (callback) => {
    const listener = (_event, value) => callback(Boolean(value));
    ipcRenderer.on("app:snapTopCenterStateChanged", listener);
    return () => ipcRenderer.removeListener("app:snapTopCenterStateChanged", listener);
  },
  getAlwaysOnTop: () => ipcRenderer.invoke("app:getAlwaysOnTop"),
  setAlwaysOnTop: (value) => ipcRenderer.invoke("app:setAlwaysOnTop", value),
  close: () => ipcRenderer.invoke("app:close"),
  openLogs: () => ipcRenderer.invoke("app:openLogs"),
  notify: (payload) => ipcRenderer.invoke("app:notify", payload)
});
