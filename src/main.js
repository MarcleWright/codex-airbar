const { app, BrowserWindow, ipcMain, Notification, screen, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { readCodexSnapshot } = require("./status-reader");

const shouldOpenDevTools = process.env.CODEX_AIRBAR_DEVTOOLS === "1";
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const logPath = path.join(app.getPath("userData"), "codex-airbar.log");
const appIconPath = path.join(__dirname, "..", "assets", process.platform === "win32" ? "icon.ico" : "icon.png");
let mainWindow = null;
let isPinnedToTop = true;
let resolvedCodexPath = null;
let allowProgrammaticMinimize = false;
let lastNormalBounds = null;
let isRestoringBounds = false;

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

function getTopCenterPosition(windowWidth, windowHeight) {
  const display = screen.getPrimaryDisplay();
  const { x, y, width, height } = display.workArea;
  const nextX = Math.round(x + (width - windowWidth) / 2);
  const nextY = y;
  return {
    x: nextX,
    y: nextY,
    maxHeight: Math.max(420, height - 48)
  };
}

function snapWindowToTopCenter(targetWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) return;
  const [windowWidth, windowHeight] = targetWindow.getSize();
  const position = getTopCenterPosition(windowWidth, windowHeight);
  targetWindow.setPosition(position.x, position.y);
}

function isWindowsSnapBounds(bounds) {
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;
  const nearlyFullHeight = Math.abs(bounds.height - area.height) <= 8;
  const nearlyFullWidth = Math.abs(bounds.width - area.width) <= 8;
  const nearlyHalfWidth = Math.abs(bounds.width - Math.round(area.width / 2)) <= 16;
  const atLeftEdge = Math.abs(bounds.x - area.x) <= 8;
  const atRightEdge = Math.abs(bounds.x + bounds.width - (area.x + area.width)) <= 8;
  const atTopEdge = Math.abs(bounds.y - area.y) <= 8;
  return atTopEdge && nearlyFullHeight && (nearlyFullWidth || nearlyHalfWidth) && (atLeftEdge || atRightEdge || nearlyFullWidth);
}

function rememberNormalBounds(targetWindow) {
  if (!targetWindow || targetWindow.isDestroyed() || isRestoringBounds) return;
  if (targetWindow.isMaximized() || targetWindow.isFullScreen() || targetWindow.isMinimized()) return;
  const bounds = targetWindow.getBounds();
  if (isWindowsSnapBounds(bounds)) return;
  lastNormalBounds = bounds;
}

function restoreFromWindowsSnap(targetWindow) {
  if (!targetWindow || targetWindow.isDestroyed() || isRestoringBounds) return;
  const bounds = targetWindow.getBounds();
  if (!isWindowsSnapBounds(bounds)) {
    rememberNormalBounds(targetWindow);
    return;
  }
  const fallback = lastNormalBounds || { width: 630, height: 210, ...getTopCenterPosition(630, 210) };
  isRestoringBounds = true;
  targetWindow.setBounds(fallback);
  queueMicrotask(() => {
    isRestoringBounds = false;
  });
}

function createWindow() {
  const width = 630;
  const height = 210;
  const position = getTopCenterPosition(width, height);

  mainWindow = new BrowserWindow({
    width,
    height: Math.min(height, position.maxHeight),
    x: position.x,
    y: position.y,
    minWidth: 480,
    minHeight: 180,
    frame: false,
    transparent: false,
    alwaysOnTop: isPinnedToTop,
    skipTaskbar: false,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: "#0f1115",
    title: "Codex Airbar",
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setAlwaysOnTop(isPinnedToTop, "floating");
  lastNormalBounds = mainWindow.getBounds();

  mainWindow.on("maximize", () => {
    mainWindow?.unmaximize();
  });
  mainWindow.on("enter-full-screen", () => {
    mainWindow?.setFullScreen(false);
  });
  mainWindow.on("minimize", (event) => {
    if (allowProgrammaticMinimize) return;
    event.preventDefault();
    mainWindow?.restore();
  });
  mainWindow.on("move", () => {
    restoreFromWindowsSnap(mainWindow);
  });
  mainWindow.on("resize", () => {
    restoreFromWindowsSnap(mainWindow);
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
  allowProgrammaticMinimize = true;
  mainWindow?.minimize();
  queueMicrotask(() => {
    allowProgrammaticMinimize = false;
  });
});

ipcMain.handle("app:snapTopCenter", () => {
  snapWindowToTopCenter(mainWindow);
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
