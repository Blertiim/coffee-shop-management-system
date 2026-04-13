const path = require("path");
const http = require("http");
const net = require("net");
const fs = require("fs");
const { spawn } = require("child_process");
const { app, BrowserWindow, Menu, dialog, shell } = require("electron");

const PREFERRED_APP_PORT = Number(process.env.PORT || 5000) || 5000;
const APP_HOST = process.env.HOST || "0.0.0.0";
const WINDOW_TITLE = "Coffee Shop POS";
const MAX_PORT_ATTEMPTS = 15;
const DEFAULT_MYSQL_HOST = "127.0.0.1";
const DEFAULT_MYSQL_PORT = 3306;
const COMMON_XAMPP_PATHS = ["C:\\xampp", "C:\\Program Files\\xampp", "D:\\xampp"];
const MYSQL_START_TIMEOUT_MS = 25000;

let mainWindow = null;
let backendHandle = null;
let backendAbortController = null;
let activeAppPort = PREFERRED_APP_PORT;

const getAppUrl = (port = activeAppPort) => `http://localhost:${port}`;
const getHealthUrl = (port = activeAppPort) => `${getAppUrl(port)}/api/health`;

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

const stripWrappingQuotes = (value) => value.replace(/^['"]|['"]$/g, "");

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((accumulator, rawLine) => {
      const line = rawLine.trim();

      if (!line || line.startsWith("#")) {
        return accumulator;
      }

      const separatorIndex = line.indexOf("=");

      if (separatorIndex <= 0) {
        return accumulator;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = stripWrappingQuotes(line.slice(separatorIndex + 1).trim());

      if (key) {
        accumulator[key] = value;
      }

      return accumulator;
    }, {});
};

const parseDatabaseConnection = (databaseUrl) => {
  if (!databaseUrl) {
    return {
      host: DEFAULT_MYSQL_HOST,
      port: DEFAULT_MYSQL_PORT,
    };
  }

  try {
    const parsedUrl = new URL(databaseUrl);

    return {
      host: parsedUrl.hostname || DEFAULT_MYSQL_HOST,
      port: Number(parsedUrl.port || DEFAULT_MYSQL_PORT) || DEFAULT_MYSQL_PORT,
    };
  } catch (error) {
    return {
      host: DEFAULT_MYSQL_HOST,
      port: DEFAULT_MYSQL_PORT,
    };
  }
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

const isPortAvailable = (port) =>
  new Promise((resolve) => {
    const tester = net.createServer();

    tester.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }

      resolve(false);
    });

    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });

    tester.listen(port, "127.0.0.1");
  });

const canConnectToTcpPort = (host, port, timeoutMs = 1500) =>
  new Promise((resolve) => {
    const socket = net.createConnection({ host, port });

    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });

    socket.once("error", () => {
      resolve(false);
    });

    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      resolve(false);
    });
  });

const waitForTcpPort = async (host, port, timeoutMs = MYSQL_START_TIMEOUT_MS) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await canConnectToTcpPort(host, port)) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  return false;
};

const isTruthyFlag = (value, defaultValue = true) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return defaultValue;
  }

  return !["0", "false", "no", "off"].includes(String(value).trim().toLowerCase());
};

const resolveXamppRoot = (envValues = {}) => {
  const configuredPath = envValues.XAMPP_PATH || process.env.XAMPP_PATH || "";
  const candidatePaths = [configuredPath, ...COMMON_XAMPP_PATHS].filter(Boolean);

  for (const candidatePath of candidatePaths) {
    const normalizedPath = path.resolve(candidatePath);
    const mysqldPath = path.join(normalizedPath, "mysql", "bin", "mysqld.exe");
    const defaultsFilePath = path.join(normalizedPath, "mysql", "bin", "my.ini");

    if (fs.existsSync(mysqldPath) && fs.existsSync(defaultsFilePath)) {
      return {
        root: normalizedPath,
        mysqldPath,
        defaultsFilePath,
      };
    }
  }

  return null;
};

const launchDetachedProcess = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const childProcess = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      ...options,
    });

    childProcess.once("error", reject);
    childProcess.once("spawn", () => {
      childProcess.unref();
      resolve(childProcess.pid);
    });
  });

const ensureDatabaseReady = async () => {
  const { backendEnvPath } = resolveDesktopPaths();
  const backendEnv = parseEnvFile(backendEnvPath);
  const { host, port } = parseDatabaseConnection(backendEnv.DATABASE_URL);

  if (await canConnectToTcpPort(host, port)) {
    return {
      host,
      port,
      startedAutomatically: false,
    };
  }

  if (!isTruthyFlag(backendEnv.AUTO_START_XAMPP_MYSQL, true)) {
    throw new Error("MySQL is not running. Start MySQL and then open the POS again.");
  }

  const xampp = resolveXamppRoot(backendEnv);

  if (!xampp) {
    throw new Error(
      "MySQL is offline and XAMPP was not found automatically. Set XAMPP_PATH or start MySQL manually."
    );
  }

  console.warn(`MySQL is offline. Attempting to start XAMPP MySQL from ${xampp.root}.`);

  await launchDetachedProcess(
    xampp.mysqldPath,
    [`--defaults-file=${xampp.defaultsFilePath}`, "--standalone"],
    {
      cwd: xampp.root,
    }
  );

  const didStart = await waitForTcpPort(host, port);

  if (!didStart) {
    throw new Error(
      "XAMPP MySQL did not come online in time. Check XAMPP/MySQL configuration and try again."
    );
  }

  return {
    host,
    port,
    startedAutomatically: true,
  };
};

const findAvailablePort = async (startPort = PREFERRED_APP_PORT) => {
  for (let offset = 0; offset < MAX_PORT_ATTEMPTS; offset += 1) {
    const candidatePort = startPort + offset;

    if (await isPortAvailable(candidatePort)) {
      return candidatePort;
    }
  }

  return null;
};

const isExpectedBackendRunning = async (port = activeAppPort) => {
  const healthResponse = await requestJson(getHealthUrl(port));

  if (healthResponse?.ok && healthResponse?.body?.data?.service === "coffee-shop-pos-backend") {
    return healthResponse.body?.data?.mode === "desktop";
  }
  return false;
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

const startBackend = async (port = activeAppPort) => {
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
  process.env.PORT = String(port);

  const { startServer } = require(backendEntryPath);

  backendAbortController = new AbortController();
  backendHandle = await startServer({
    host: APP_HOST,
    port,
    signal: backendAbortController.signal,
  });
  activeAppPort = port;

  await waitForServer(getAppUrl(port));
};

const ensureBackendReady = async () => {
  if (await isExpectedBackendRunning(PREFERRED_APP_PORT)) {
    activeAppPort = PREFERRED_APP_PORT;
    return { reusedExistingServer: true };
  }

  try {
    await startBackend(PREFERRED_APP_PORT);
    return { reusedExistingServer: false };
  } catch (error) {
    if (error?.code === "EADDRINUSE") {
      if (await isExpectedBackendRunning(PREFERRED_APP_PORT)) {
        activeAppPort = PREFERRED_APP_PORT;
        return { reusedExistingServer: true };
      }

      const fallbackPort = await findAvailablePort(PREFERRED_APP_PORT + 1);

      if (!fallbackPort) {
        throw new Error(
          `Port ${PREFERRED_APP_PORT} is busy and no fallback desktop port was available nearby. Close the other app or set a different PORT before starting Electron.`
        );
      }

      console.warn(
        `Port ${PREFERRED_APP_PORT} is busy. Starting the desktop POS on fallback port ${fallbackPort}.`
      );
      await startBackend(fallbackPort);
      return { reusedExistingServer: false, fallbackPort };
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
    if (url.startsWith(getAppUrl())) {
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

  mainWindow.loadURL(getAppUrl());
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
      await ensureDatabaseReady();
      await ensureBackendReady();
      createMainWindow();
    } catch (error) {
      console.error("Failed to launch desktop POS:", error);
      dialog.showErrorBox(
        "Desktop POS failed to start",
        `${error.message}\n\nMake sure the frontend has been built and XAMPP/MySQL is available.`
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
