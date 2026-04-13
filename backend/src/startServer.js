const path = require("path");

require("dotenv").config({
  path: process.env.BACKEND_ENV_PATH || path.resolve(__dirname, "../.env"),
});

const { assertSecurityConfig } = require("./config/security");
const app = require("./app");
const { refreshAllInventoryAlerts } = require("./services/alert.service");

const INVENTORY_ALERT_RETRY_MS = Math.max(
  Number(process.env.INVENTORY_ALERT_RETRY_MS || 30000) || 30000,
  5000
);

const DEFAULT_PORT = Number(process.env.PORT || 5000) || 5000;
const DEFAULT_HOST = process.env.HOST || "0.0.0.0";

const wait = (delayMs) =>
  new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Number(delayMs) || 0));
  });

const runInventoryAlertLoop = async ({
  signal,
  retryDelayMs = INVENTORY_ALERT_RETRY_MS,
  logger = console,
}) => {
  while (!signal.aborted) {
    try {
      const result = await refreshAllInventoryAlerts();

      if (!result?.ok && result?.retryable) {
        logger.warn(
          `Inventory alert refresh skipped: database is unavailable at startup. Start MySQL and retrying in ${
            retryDelayMs / 1000
          }s.`
        );
        await wait(retryDelayMs);
        continue;
      }

      if (result?.ok) {
        logger.log(`Inventory alerts synced for ${result.count} inventory items.`);
      }

      return;
    } catch (error) {
      logger.error("Inventory alert refresh error:", error);
      await wait(retryDelayMs);
    }
  }
};

const startServer = async (options = {}) => {
  assertSecurityConfig();

  const port = Number(options.port || process.env.PORT || DEFAULT_PORT) || DEFAULT_PORT;
  const host = options.host || process.env.HOST || DEFAULT_HOST;
  const logger = options.logger || console;
  const signal = options.signal || new AbortController().signal;
  const shouldLogStartup = options.logStartup !== false;

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host);
    let isResolved = false;
    let isStopping = false;
    let stopPromise = null;

    const cleanup = () => {
      server.off("error", handleError);
      server.off("listening", handleListening);
    };

    const stop = () => {
      if (stopPromise) {
        return stopPromise;
      }

      isStopping = true;
      stopPromise = new Promise((closeResolve, closeReject) => {
        cleanup();
        server.close((error) => {
          if (error && error.code !== "ERR_SERVER_NOT_RUNNING") {
            closeReject(error);
            return;
          }

          closeResolve();
        });
      });

      return stopPromise;
    };

    const handleError = (error) => {
      cleanup();

      if (!isResolved) {
        reject(error);
        return;
      }

      if (!isStopping) {
        logger.error("Express server error:", error);
      }
    };

    const handleListening = () => {
      cleanup();
      isResolved = true;

      const address = server.address();
      const resolvedHost =
        typeof address === "object" && address?.address
          ? address.address === "::"
            ? "localhost"
            : address.address
          : host;
      const resolvedPort =
        typeof address === "object" && address?.port ? address.port : port;
      const url = `http://${resolvedHost === "0.0.0.0" ? "localhost" : resolvedHost}:${resolvedPort}`;

      if (shouldLogStartup) {
        logger.log(`Server running on http://${host}:${resolvedPort}`);
      }

      signal.addEventListener(
        "abort",
        () => {
          stop().catch((error) => {
            logger.error("Failed to close Express server cleanly:", error);
          });
        },
        { once: true }
      );

      runInventoryAlertLoop({ signal, logger }).catch((error) => {
        logger.error("Inventory alert loop error:", error);
      });

      resolve({
        app,
        server,
        port: resolvedPort,
        host,
        url,
        stop,
      });
    };

    server.once("error", handleError);
    server.once("listening", handleListening);
  });
};

module.exports = {
  startServer,
};
