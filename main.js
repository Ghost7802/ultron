/**
 * @file electron/main.js
 * @description Electron main process for the ULTRON desktop application.
 *
 * Responsibilities:
 * - Spawns the Next.js frontend server (standalone build) as a child process.
 * - Creates the main BrowserWindow with the ULTRON orb UI.
 * - Handles camera/microphone permission requests respecting system privacy settings.
 * - Manages application lifecycle (quit, window close).
 */

const { app, BrowserWindow, session } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let mainWindow = null;
let nextProcess = null;

const NEXT_PORT = 3000;
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
   * Permission request handler for camera and microphone access.
   * Respects system privacy settings: grants media permissions so the OS can
   * show its own system-level dialog, denies all other permissions.
   */
  const ses = mainWindow.webContents.session;
  ses.setPermissionCheckHandler((webContents, permission, _requestingOrigin, details) => {
    if (permission === "media" || permission === "microphone" || permission === "camera") {
      try {
        if (webContents && mainWindow && webContents === mainWindow.webContents) {
          const url = webContents.getURL();
          if (url.includes('localhost') || url.includes('127.0.0.1')) {
            return true;
          }
        }
      } catch (e) {}
      return true;
    }
    return false;
  });

  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === "microphone" || permission === "camera" || permission === "media") {
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
  const standaloneServer = path.join(
    __dirname,
    "..",
    ".next",
    "standalone",
    "server.js"
  );

  nextProcess = spawn(process.execPath, [standaloneServer], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
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
