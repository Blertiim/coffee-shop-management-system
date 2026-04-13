const path = require("path");
const http = require("http");
const fs = require("fs");
const { app, BrowserWindow, Menu, dialog, shell } = require("electron");

const APP_PORT = Number(process.env.PORT || 5000) || 5000;
const APP_HOST = process.env.HOST || "0.0.0.0";
const APP_URL = `http://localhost:${APP_PORT}`;
const APP_HEALTH_URL = `${APP_URL}/api/health`;
const WINDOW_TITLE = "Coffee Shop POS";

let mainWindow = null;
let backendHandle = null;
let backendAbortController = null;

const getAppRoot = () =>
  app.isPackaged ? process.resourcesPath : path.resolve(__dirname, "..");

const resolveDesktopPaths = () => {
  const appRoot = getAppRoot();
  const backendRoot = path.join(appRoot, "backend");
  const frontendDistPath = path.join(appRoot, "frontend", "dist");

  return {
    appRoot,
    backendRoot,
    frontendDistPath,
    backendEntryPath: path.join(backendRoot, "src", "startServer.js"),
    backendEnvPath: path.join(backendRoot, ".env"),
  };
};

const pingServer = (url) =>
  new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 500);
    });

    request.on("error", () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });

const requestJson = (url) =>
  new Promise((resolve) => {
    const request = http.get(url, (response) => {
      let raw = "";

      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        raw += chunk;
      });
      response.on("end", () => {
        try {
          resolve({
            ok: response.statusCode >= 200 && response.statusCode < 300,
            statusCode: response.statusCode,
            body: raw ? JSON.parse(raw) : null,
          });
        } catch (error) {
          resolve({
            ok: false,
            statusCode: response.statusCode,
            body: null,
          });
        }
      });
    });

    request.on("error", () => resolve(null));
    request.setTimeout(1500, () => {
      request.destroy();
      resolve(null);
    });
  });

const requestStatus = (url) =>
  new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode || 0);
    });

    request.on("error", () => resolve(0));
    request.setTimeout(1500, () => {
      request.destroy();
      resolve(0);
    });
  });

const isExpectedBackendRunning = async () => {
  const healthResponse = await requestJson(APP_HEALTH_URL);

  if (healthResponse?.ok && healthResponse?.body?.data?.service === "coffee-shop-pos-backend") {
    return true;
  }

  const posStaffStatus = await requestStatus(`${APP_URL}/api/auth/pos-staff`);
  return posStaffStatus > 0 && posStaffStatus !== 404;
};

const waitForServer = async (url, timeoutMs = 20000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const isReady = await pingServer(url);

    if (isReady) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`Timed out waiting for the POS server at ${url}`);
};

const startBackend = async () => {
  const { backendEntryPath, backendEnvPath, frontendDistPath } = resolveDesktopPaths();
  const frontendIndexPath = path.join(frontendDistPath, "index.html");

  if (!fs.existsSync(backendEntryPath)) {
    throw new Error(`Backend entry file not found at ${backendEntryPath}`);
  }

  if (!fs.existsSync(frontendIndexPath)) {
    throw new Error(
      `Frontend production build was not found at ${frontendIndexPath}. Run the build first.`
    );
  }

  process.env.SERVE_FRONTEND_DIST = "true";
  process.env.FRONTEND_DIST_PATH = frontendDistPath;
  process.env.BACKEND_ENV_PATH = backendEnvPath;

  const { startServer } = require(backendEntryPath);

  backendAbortController = new AbortController();
  backendHandle = await startServer({
    host: APP_HOST,
    port: APP_PORT,
    signal: backendAbortController.signal,
  });

  await waitForServer(APP_URL);
};

const ensureBackendReady = async () => {
  if (await isExpectedBackendRunning()) {
    return { reusedExistingServer: true };
  }

  try {
    await startBackend();
    return { reusedExistingServer: false };
  } catch (error) {
    if (error?.code === "EADDRINUSE") {
      if (await isExpectedBackendRunning()) {
        return { reusedExistingServer: true };
      }

      throw new Error(
        `Port ${APP_PORT} is already being used by another application. Close that app or change the POS port before starting the desktop app.`
      );
    }

    throw error;
  }
};

const createMainWindow = () => {
  mainWindow = new BrowserWindow({
    title: WINDOW_TITLE,
    show: false,
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    backgroundColor: "#09111b",
    fullscreenable: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(APP_URL)) {
      return { action: "allow" };
    }

    shell.openExternal(url).catch(() => {});
    return { action: "deny" };
  });

  mainWindow.once("ready-to-show", () => {
    if (!mainWindow) {
      return;
    }

    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.loadURL(APP_URL);
};

const shutdownBackend = async () => {
  if (backendAbortController) {
    backendAbortController.abort();
    backendAbortController = null;
  }

  if (backendHandle?.stop) {
    try {
      await backendHandle.stop();
    } catch (error) {
      console.error("Failed to stop backend server cleanly:", error);
    }
  }

  backendHandle = null;
};

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    try {
      Menu.setApplicationMenu(null);
      await ensureBackendReady();
      createMainWindow();
    } catch (error) {
      console.error("Failed to launch desktop POS:", error);
      dialog.showErrorBox(
        "Desktop POS failed to start",
        `${error.message}\n\nMake sure MySQL is available and the frontend has been built.`
      );
      await shutdownBackend();
      app.quit();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });

  app.on("before-quit", async () => {
    await shutdownBackend();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
