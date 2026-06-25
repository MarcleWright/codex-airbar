const { app, BrowserWindow, ipcMain, Notification, screen, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { readCodexSnapshot } = require("./status-reader");

const shouldOpenDevTools = process.env.CODEX_AIRBAR_DEVTOOLS === "1";
const logPath = path.join(app.getPath("userData"), "codex-airbar.log");
let mainWindow = null;

function log(message, error) {
  const detail = error ? `\n${error.stack || error.message || String(error)}` : "";
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}${detail}\n`, "utf8");
}

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const width = 420;
  const height = 620;
  const x = Math.max(display.workArea.x, display.workArea.x + display.workArea.width - width - 24);
  const y = Math.max(display.workArea.y, display.workArea.y + 56);

  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: 340,
    minHeight: 420,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    backgroundColor: "#101317",
    title: "Codex Airbar",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setAlwaysOnTop(true, "floating");
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.webContents.on("did-fail-load", (_event, code, description) => {
    log(`Renderer failed to load: ${code} ${description}`);
  });

  if (shouldOpenDevTools) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

app.whenReady().then(() => {
  log("App ready");
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((error) => {
  log("App startup failed", error);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

process.on("uncaughtException", (error) => {
  log("Uncaught exception", error);
});

process.on("unhandledRejection", (error) => {
  log("Unhandled rejection", error);
});

ipcMain.handle("codex:getSnapshot", async () => {
  try {
    return readCodexSnapshot();
  } catch (error) {
    log("Snapshot read failed", error);
    return {
      generatedAt: new Date().toISOString(),
      error: error.message || String(error),
      codexHome: path.join(os.homedir(), ".codex"),
      projects: []
    };
  }
});

ipcMain.handle("app:minimize", () => {
  mainWindow?.minimize();
});

ipcMain.handle("app:close", () => {
  mainWindow?.close();
});

ipcMain.handle("app:openLogs", () => {
  shell.openPath(logPath);
});

ipcMain.handle("app:notify", (_event, payload) => {
  if (!Notification.isSupported()) return false;
  const notification = new Notification({
    title: payload?.title || "Codex Airbar",
    body: payload?.body || "Codex session status changed."
  });
  notification.show();
  return true;
});
