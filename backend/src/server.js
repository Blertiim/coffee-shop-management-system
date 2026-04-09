require("dotenv").config();
const { assertSecurityConfig } = require("./config/security");
const app = require("./app");
const { refreshAllInventoryAlerts } = require("./services/alert.service");

assertSecurityConfig();

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";
const INVENTORY_ALERT_RETRY_MS = Math.max(
  Number(process.env.INVENTORY_ALERT_RETRY_MS || 30000) || 30000,
  5000
);

let inventoryAlertRetryTimer = null;

const clearInventoryAlertRetryTimer = () => {
  if (!inventoryAlertRetryTimer) {
    return;
  }

  clearTimeout(inventoryAlertRetryTimer);
  inventoryAlertRetryTimer = null;
};

const scheduleInventoryAlertRefresh = (delayMs = 0) => {
  clearInventoryAlertRetryTimer();

  inventoryAlertRetryTimer = setTimeout(async () => {
    try {
      const result = await refreshAllInventoryAlerts();

      if (!result?.ok && result?.retryable) {
        console.warn(
          `Inventory alert refresh skipped: database is unavailable at startup. Start MySQL and retrying in ${
            INVENTORY_ALERT_RETRY_MS / 1000
          }s.`
        );
        scheduleInventoryAlertRefresh(INVENTORY_ALERT_RETRY_MS);
        return;
      }

      if (result?.ok) {
        console.log(`Inventory alerts synced for ${result.count} inventory items.`);
      }
    } catch (error) {
      console.error("Inventory alert refresh error:", error);
      scheduleInventoryAlertRefresh(INVENTORY_ALERT_RETRY_MS);
    }
  }, Math.max(0, Number(delayMs) || 0));
};

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  scheduleInventoryAlertRefresh();
});
