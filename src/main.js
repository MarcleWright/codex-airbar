const { app, BrowserWindow, ipcMain, Menu, Notification, Tray, screen, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { readCodexSnapshot } = require("./status-reader");

const shouldOpenDevTools = process.env.CODEX_AIRBAR_DEVTOOLS === "1";
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const logPath = path.join(app.getPath("userData"), "codex-airbar.log");
const appIconPath = path.join(__dirname, "..", "assets", process.platform === "win32" ? "icon.ico" : "icon.png");
const DEFAULT_WINDOW_WIDTH = 630;
const TITLE_BAR_HEIGHT = 32;
let mainWindow = null;
let isPinnedToTop = true;
let windowWidth = DEFAULT_WINDOW_WIDTH;
let resolvedCodexPath = null;
let allowProgrammaticMinimize = false;
let tray = null;
let isQuitting = false;
let isHidingToTray = false;
let hasShownTrayHint = false;
let lastDuplicateLaunchNoticeAt = 0;
let lastUnsnapBounds = null;
let themeSurface = "classic";

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
}

function log(message, error) {
  const detail = error ? `\n${error.stack || error.message || String(error)}` : "";
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}${detail}\n`, "utf8");
}

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function findCodexExecutable() {
  if (resolvedCodexPath) return resolvedCodexPath;

  const candidates = [];
  if (process.env.CODEX_AIRBAR_CODEX_PATH) {
    candidates.push(process.env.CODEX_AIRBAR_CODEX_PATH);
  }

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    const desktopBin = path.join(localAppData, "OpenAI", "Codex", "bin");
    try {
      const versionedBins = fs
        .readdirSync(desktopBin, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(desktopBin, entry.name, "codex.exe"))
        .filter((candidate) => safeStat(candidate))
        .sort((a, b) => safeStat(b).mtimeMs - safeStat(a).mtimeMs);
      candidates.push(...versionedBins);
    } catch {
      // Desktop installs are optional; PATH remains the final fallback.
    }
    candidates.push(
      path.join(localAppData, "OpenAI", "Codex", "bin", "codex.exe"),
      path.join(localAppData, "Programs", "OpenAI", "Codex", "bin", "codex.exe")
    );
  }

  resolvedCodexPath = candidates.find((candidate) => safeStat(candidate)) || "codex";
  log(`Using Codex executable: ${resolvedCodexPath}`);
  return resolvedCodexPath;
}

function quoteCmdArg(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function getTopCenterPosition(windowBounds) {
  const display = windowBounds ? screen.getDisplayMatching(windowBounds) : screen.getPrimaryDisplay();
  const { x, y, width, height } = display.workArea;
  const nextX = Math.round(x + (width - windowBounds.width) / 2);
  const nextY = y;
  return {
    x: nextX,
    y: nextY,
    maxHeight: Math.max(420, height - 48)
  };
}

function clampWindowWidth(nextWidth) {
  const parsedWidth = Number(nextWidth);
  if (!Number.isFinite(parsedWidth)) return windowWidth;
  return Math.max(520, Math.min(Math.round(parsedWidth), 920));
}

function applyWindowWidth(targetWindow, nextWidth) {
  if (!targetWindow || targetWindow.isDestroyed()) return windowWidth;
  windowWidth = clampWindowWidth(nextWidth);
  const bounds = targetWindow.getBounds();
  const wasTopCenterSnapped = isTopCenterSnapped(targetWindow);
  const display = screen.getDisplayMatching(bounds);
  const maxHeight = Math.max(180, display.workArea.height - 48);
  targetWindow.setMinimumSize(windowWidth, bounds.height <= TITLE_BAR_HEIGHT ? TITLE_BAR_HEIGHT : 180);
  targetWindow.setMaximumSize(windowWidth, maxHeight);

  const nextBounds = {
    ...bounds,
    width: windowWidth
  };
  if (wasTopCenterSnapped) {
    const position = getTopCenterPosition(nextBounds);
    nextBounds.x = position.x;
    nextBounds.y = position.y;
  }
  targetWindow.setBounds(nextBounds);
  emitSnapTopCenterState(targetWindow);
  return windowWidth;
}

function snapWindowToTopCenter(targetWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) return;
  const bounds = targetWindow.getBounds();
  if (isTopCenterSnapped(targetWindow)) {
    if (lastUnsnapBounds) {
      targetWindow.setBounds({
        ...lastUnsnapBounds,
        width: windowWidth
      });
    }
    emitSnapTopCenterState(targetWindow);
    return;
  }

  lastUnsnapBounds = bounds;
  const position = getTopCenterPosition({ ...bounds, width: windowWidth });
  targetWindow.setBounds({
    ...bounds,
    width: windowWidth,
    x: position.x,
    y: position.y
  });
  emitSnapTopCenterState(targetWindow);
}

function setWindowContentHeight(targetWindow, nextHeight) {
  if (!targetWindow || targetWindow.isDestroyed()) return false;
  const parsedHeight = Number(nextHeight);
  if (!Number.isFinite(parsedHeight)) return false;

  const wasTopCenterSnapped = isTopCenterSnapped(targetWindow);
  const bounds = targetWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const maxHeight = Math.max(180, display.workArea.height - 48);
  const height = Math.max(TITLE_BAR_HEIGHT, Math.min(Math.round(parsedHeight), maxHeight));
  targetWindow.setMinimumSize(windowWidth, height <= TITLE_BAR_HEIGHT ? TITLE_BAR_HEIGHT : 180);
  targetWindow.setMaximumSize(windowWidth, maxHeight);
  if (Math.abs(bounds.height - height) <= 1) return wasTopCenterSnapped;

  const nextBounds = {
    ...bounds,
    width: windowWidth,
    height
  };
  if (wasTopCenterSnapped) {
    const position = getTopCenterPosition({ ...bounds, width: windowWidth, height });
    nextBounds.x = position.x;
    nextBounds.y = position.y;
  }

  targetWindow.setBounds(nextBounds);
  emitSnapTopCenterState(targetWindow);
  return isTopCenterSnapped(targetWindow);
}

function isTopCenterSnapped(targetWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) return false;
  const bounds = targetWindow.getBounds();
  const position = getTopCenterPosition(bounds);
  return Math.abs(bounds.x - position.x) <= 2 && Math.abs(bounds.y - position.y) <= 2;
}

function emitSnapTopCenterState(targetWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) return;
  targetWindow.webContents.send("app:snapTopCenterStateChanged", isTopCenterSnapped(targetWindow));
}

function applyThemeSurface(targetWindow, nextSurface) {
  if (!targetWindow || targetWindow.isDestroyed()) return themeSurface;
  themeSurface = nextSurface === "glass" ? "glass" : "classic";

  try {
    targetWindow.setBackgroundMaterial(themeSurface === "glass" ? "acrylic" : "none");
  } catch (error) {
    log(`Failed to apply ${themeSurface} background material`, error);
  }

  return themeSurface;
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  isHidingToTray = false;
  mainWindow.setSkipTaskbar(false);
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();
}

function hideMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  isHidingToTray = true;
  mainWindow.setSkipTaskbar(true);
  mainWindow.hide();
  showTrayHintOnce();
}

function showTrayHintOnce() {
  if (hasShownTrayHint || !Notification.isSupported()) return;
  hasShownTrayHint = true;
  const notification = new Notification({
    title: "Codex Airbar is still running",
    body: "The window was hidden to the system tray. Use the tray icon to restore or quit."
  });
  notification.show();
}

function showDuplicateLaunchNotice() {
  if (!Notification.isSupported()) return;
  const now = Date.now();
  if (now - lastDuplicateLaunchNoticeAt < 5000) return;
  lastDuplicateLaunchNoticeAt = now;
  const notification = new Notification({
    title: "Codex Airbar is already running",
    body: "The existing window has been restored from the system tray."
  });
  notification.show();
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: "Show Airbar",
      click: () => showMainWindow()
    },
    {
      label: isPinnedToTop ? "Disable Always On Top" : "Enable Always On Top",
      click: () => {
        isPinnedToTop = !isPinnedToTop;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.setAlwaysOnTop(isPinnedToTop, "floating");
        }
        refreshTrayMenu();
      }
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        tray?.destroy();
        app.quit();
      }
    }
  ]);
}

function refreshTrayMenu() {
  if (!tray || tray.isDestroyed()) return;
  tray.setContextMenu(buildTrayMenu());
}

function createTray() {
  if (tray && !tray.isDestroyed()) return tray;
  tray = new Tray(appIconPath);
  tray.setToolTip("Codex Airbar");
  refreshTrayMenu();
  tray.on("click", () => {
    showMainWindow();
  });
  tray.on("double-click", () => {
    showMainWindow();
  });
  return tray;
}

function createWindow() {
  const width = windowWidth;
  const height = 210;
  const position = getTopCenterPosition({ x: 0, y: 0, width, height });

  mainWindow = new BrowserWindow({
    width,
    height: Math.min(height, position.maxHeight),
    x: position.x,
    y: position.y,
    minWidth: windowWidth,
    maxWidth: windowWidth,
    minHeight: TITLE_BAR_HEIGHT,
    frame: false,
    transparent: true,
    alwaysOnTop: isPinnedToTop,
    skipTaskbar: false,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: "#00000000",
    title: "Codex Airbar",
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setAlwaysOnTop(isPinnedToTop, "floating");
  applyThemeSurface(mainWindow, themeSurface);
  mainWindow.setMinimumSize(windowWidth, TITLE_BAR_HEIGHT);
  mainWindow.setMaximumSize(windowWidth, position.maxHeight);

  mainWindow.on("maximize", () => {
    mainWindow?.unmaximize();
  });
  mainWindow.on("enter-full-screen", () => {
    mainWindow?.setFullScreen(false);
  });
  mainWindow.on("minimize", (event) => {
    if (allowProgrammaticMinimize) {
      mainWindow?.setSkipTaskbar(false);
      return;
    }
    event.preventDefault();
    setImmediate(() => showMainWindow());
  });
  mainWindow.on("restore", () => {
    showMainWindow();
  });
  mainWindow.on("show", () => {
    mainWindow?.setSkipTaskbar(false);
  });
  mainWindow.on("hide", () => {
    if (isQuitting || isHidingToTray) return;
    setImmediate(() => showMainWindow());
  });
  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    hideMainWindow();
  });
  mainWindow.on("move", () => {
    emitSnapTopCenterState(mainWindow);
  });
  mainWindow.on("resize", () => {
    emitSnapTopCenterState(mainWindow);
  });

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "renderer", "index.html"));
  }

  mainWindow.webContents.on("did-fail-load", (_event, code, description) => {
    log(`Renderer failed to load: ${code} ${description}`);
  });

  if (shouldOpenDevTools) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

if (gotSingleInstanceLock) {
  app.on("second-instance", () => {
    log("Second launch detected; restoring existing instance.");
    showMainWindow();
    showDuplicateLaunchNotice();
  });
}

app.whenReady().then(() => {
  log("App ready");
  createTray();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      return;
    }
    showMainWindow();
  });
}).catch((error) => {
  log("App startup failed", error);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && isQuitting) app.quit();
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
  allowProgrammaticMinimize = true;
  mainWindow?.minimize();
  queueMicrotask(() => {
    allowProgrammaticMinimize = false;
  });
});

ipcMain.handle("app:snapTopCenter", () => {
  snapWindowToTopCenter(mainWindow);
  return isTopCenterSnapped(mainWindow);
});

ipcMain.handle("app:isTopCenterSnapped", () => {
  return isTopCenterSnapped(mainWindow);
});

ipcMain.handle("app:setContentHeight", (_event, height) => {
  return setWindowContentHeight(mainWindow, height);
});

ipcMain.handle("app:getWindowWidth", () => {
  return windowWidth;
});

ipcMain.handle("app:setWindowWidth", (_event, nextWidth) => {
  return applyWindowWidth(mainWindow, nextWidth);
});

ipcMain.handle("app:setThemeSurface", (_event, nextSurface) => {
  return applyThemeSurface(mainWindow, nextSurface);
});

ipcMain.handle("app:getAlwaysOnTop", () => {
  return mainWindow?.isAlwaysOnTop() ?? isPinnedToTop;
});

ipcMain.handle("app:setAlwaysOnTop", (_event, nextValue) => {
  const nextPinned = Boolean(nextValue);
  isPinnedToTop = nextPinned;
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(nextPinned, "floating");
  }
  refreshTrayMenu();
  return isPinnedToTop;
});

ipcMain.handle("app:close", () => {
  mainWindow?.close();
});

ipcMain.handle("app:openLogs", () => {
  shell.openPath(logPath);
});

ipcMain.handle("codex:openProject", async (_event, workspacePath) => {
  if (typeof workspacePath !== "string" || workspacePath.trim() === "" || workspacePath === "Projectless") {
    return {
      ok: false,
      error: "This session does not have a project workspace to open."
    };
  }

  return new Promise((resolve) => {
    const codexPath = findCodexExecutable();
    const codex = spawn(codexPath, ["app", workspacePath], {
      detached: true,
      stdio: "ignore",
      shell: process.platform === "win32" && codexPath === "codex"
    });

    codex.once("error", (error) => {
      log(`Failed to open Codex project: ${workspacePath}`, error);
      resolve({
        ok: false,
        error: error.message || String(error)
      });
    });

    codex.once("spawn", () => {
      codex.unref();
      resolve({ ok: true });
    });
  });
});

ipcMain.handle("codex:resumeSession", async (_event, sessionId, workspacePath) => {
  if (typeof sessionId !== "string" || sessionId.trim() === "") {
    return {
      ok: false,
      error: "This session does not have a valid session id to resume."
    };
  }

  return new Promise((resolve) => {
    const codexPath = findCodexExecutable();
    const resumeArgs = ["resume"];
    if (typeof workspacePath === "string" && workspacePath.trim() !== "" && workspacePath !== "Projectless") {
      resumeArgs.push("-C", workspacePath);
    }
    resumeArgs.push(sessionId);
    const resumeProcess =
      process.platform === "win32"
        ? spawn("cmd.exe", ["/d", "/s", "/c", `start "Codex Session" cmd.exe /k ${[codexPath, ...resumeArgs].map(quoteCmdArg).join(" ")}`], {
            detached: true,
            stdio: "ignore"
          })
        : spawn(codexPath, resumeArgs, {
            detached: true,
            stdio: "inherit"
          });

    resumeProcess.once("error", (error) => {
      log(`Failed to resume Codex session: ${sessionId}`, error);
      resolve({
        ok: false,
        error: error.message || String(error)
      });
    });

    resumeProcess.once("spawn", () => {
      resumeProcess.unref();
      resolve({ ok: true });
    });
  });
});

ipcMain.handle("app:openProjectFolder", async (_event, workspacePath) => {
  if (typeof workspacePath !== "string" || workspacePath.trim() === "" || workspacePath === "Projectless") {
    return {
      ok: false,
      error: "This project does not have a workspace folder to open."
    };
  }

  const result = await shell.openPath(workspacePath);
  if (result) {
    log(`Failed to open project folder: ${workspacePath}\n${result}`);
    return {
      ok: false,
      error: result
    };
  }

  return { ok: true };
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
