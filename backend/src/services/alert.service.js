const prisma = require("../config/prisma");
const { invalidateCacheByPrefix } = require("./cache.service");
const { publishRealtimeEvent } = require("./realtime.service");

const LOW_INVENTORY_ALERT_TYPE = "inventory.low";

const isDatabaseUnavailableError = (error) => {
  const message = String(error?.message || "");

  return (
    error?.name === "PrismaClientInitializationError" ||
    message.includes("Can't reach database server") ||
    message.includes("Connection refused") ||
    message.includes("ECONNREFUSED")
  );
};

const buildAlertMessage = (inventoryItem) =>
  `${inventoryItem.itemName} is below minimum stock (${inventoryItem.currentQuantity} ${inventoryItem.unit} left, minimum ${inventoryItem.minimumQuantity}).`;

const createAlertMeta = (inventoryItem) => ({
  itemName: inventoryItem.itemName,
  unit: inventoryItem.unit,
  currentQuantity: inventoryItem.currentQuantity,
  minimumQuantity: inventoryItem.minimumQuantity,
  supplierId: inventoryItem.supplierId,
});

const triggerAlertRefresh = () => {
  invalidateCacheByPrefix("system:");
  invalidateCacheByPrefix("dashboard:");
  publishRealtimeEvent(["alerts", "inventory", "dashboard"], {
    type: "system-alerts.changed",
  });
};

const syncInventoryAlertWithClient = async (client, inventoryItem) => {
  const entityId = String(inventoryItem.id);
  const isLow = Number(inventoryItem.currentQuantity) <= Number(inventoryItem.minimumQuantity);
  const existingOpenAlert = await client.systemAlert.findFirst({
    where: {
      type: LOW_INVENTORY_ALERT_TYPE,
      entityType: "inventory",
      entityId,
      status: "open",
    },
  });

  if (isLow) {
    const payload = {
      type: LOW_INVENTORY_ALERT_TYPE,
      severity:
        Number(inventoryItem.currentQuantity) === 0 ? "critical" : "warning",
      title: `Low inventory: ${inventoryItem.itemName}`,
      message: buildAlertMessage(inventoryItem),
      status: "open",
      entityType: "inventory",
      entityId,
      meta: createAlertMeta(inventoryItem),
      resolvedAt: null,
    };

    if (existingOpenAlert) {
      await client.systemAlert.update({
        where: { id: existingOpenAlert.id },
        data: payload,
      });
    } else {
      await client.systemAlert.create({
        data: payload,
      });
    }

    triggerAlertRefresh();
    return;
  }

  if (existingOpenAlert) {
    await client.systemAlert.update({
      where: { id: existingOpenAlert.id },
      data: {
        status: "resolved",
        resolvedAt: new Date(),
      },
    });

    triggerAlertRefresh();
  }
};

const syncInventoryAlert = async (inventoryItem, tx = prisma) => {
  if (!inventoryItem) {
    return;
  }

  await syncInventoryAlertWithClient(tx, inventoryItem);
};

const refreshAllInventoryAlerts = async () => {
  try {
    const items = await prisma.inventory.findMany();

    for (const item of items) {
      // Sequential updates keep the logic simple and the data consistent.
      await syncInventoryAlert(item, prisma);
    }

    return {
      ok: true,
      count: items.length,
      retryable: false,
    };
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return {
        ok: false,
        count: 0,
        retryable: true,
        error,
      };
    }

    throw error;
  }
};

const getSystemAlerts = async ({ status = "open", limit = 50 } = {}) =>
  prisma.systemAlert.findMany({
    where: {
      ...(status ? { status } : {}),
    },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: Math.min(Math.max(Number(limit) || 50, 1), 200),
  });

module.exports = {
  getSystemAlerts,
  isDatabaseUnavailableError,
  refreshAllInventoryAlerts,
  syncInventoryAlert,
};
