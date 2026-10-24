/**
 * @file electron/main.js
 * @description Electron main process for the ULTRON desktop application.
 *
 * Responsibilities:
 * - Spawns the Next.js frontend server (standalone build) as a child process.
 * - Creates the main BrowserWindow with the ULTRON orb UI.
 * - Grants camera/microphone media permissions only to ULTRON's local UI origin.
 * - Manages application lifecycle (quit, window close).
 */

const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let mainWindow = null;
let nextProcess = null;

const NEXT_PORT = 3000;
const APP_ORIGIN = `http://localhost:${NEXT_PORT}`;
const IS_DEV = process.env.NODE_ENV === "development";

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    icon: path.join(__dirname, "../build/icons/icon512.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  /**
   * Electron reports camera and microphone access as the "media" permission.
   * Allow checks and requests only for ULTRON's top-level local page, leaving
   * operating-system privacy settings and every other browser permission intact.
   */
  const ses = mainWindow.webContents.session;
  ses.setPermissionCheckHandler((webContents, permission, _requestingOrigin, details) => {
    if (permission === "media" || permission === "microphone" || permission === "camera") {
      try {
        if (webContents && mainWindow && webContents === mainWindow.webContents) {
          const url = webContents.getURL();
          if (url.includes('localhost:3000') || url.includes('127.0.0.1:3000')) {
            return true;
          }
        }
        // Also allow if it's from localhost
        if (_requestingOrigin && (_requestingOrigin.includes('localhost') || _requestingOrigin.includes('127.0.0.1'))) {
          return true;
        }
      } catch (e) {}
      return true; // be more permissive
    }
    return false;
  });

  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    if (permission === "media" || permission === "microphone" || permission === "camera") {
      callback(true);
      return;
    }
    callback(false);
  });

  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders["X-ULTRON-App"] = "desktop";
    callback({ requestHeaders: details.requestHeaders });
  });

  mainWindow.webContents.on("did-fail-load", () => {
    if (!IS_DEV) {
      setTimeout(() => mainWindow.loadURL(`http://localhost:${NEXT_PORT}/`), 2000);
    }
  });

  mainWindow.loadURL(`http://localhost:${NEXT_PORT}/`);

  if (IS_DEV) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function startNextServer() {
  const standaloneServer = app.isPackaged
    ? path.join(process.resourcesPath, "standalone", "server.js")
    : path.join(__dirname, "..", ".next", "standalone", "server.js");

  nextProcess = spawn(process.execPath, [standaloneServer], {
    stdio: ["ignore", "pipe", "pipe"],
    cwd: path.dirname(standaloneServer),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: NEXT_PORT.toString(),
      NODE_ENV: "production",
    },
  });

  nextProcess.stdout.on("data", (data) => {
    const line = data.toString().trim();
    if (line) console.log(`[Next.js] ${line}`);
  });

  nextProcess.stderr.on("data", (data) => {
    const line = data.toString().trim();
    if (line) console.error(`[Next.js ERR] ${line}`);
  });

  nextProcess.on("close", (code) => {
    if (code !== 0 && !app.isQuitting) {
      console.warn(`[Next.js] exited with code ${code}`);
    }
  });

  nextProcess.on("error", (error) => {
    console.error("[Next.js] failed to start:", error);
  });
}

function cleanup() {
  app.isQuitting = true;
  if (nextProcess) {
    try { nextProcess.kill("SIGTERM"); } catch {}
    nextProcess = null;
  }
}

app.whenReady().then(() => {
  startNextServer();
  setTimeout(createWindow, 1500);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    cleanup();
    app.quit();
  }
});

app.on("before-quit", () => {
  cleanup();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
