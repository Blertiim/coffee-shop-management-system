const prisma = require("../config/prisma");
const { invalidateCacheByPrefix } = require("./cache.service");
const { publishRealtimeEvent } = require("./realtime.service");

const LOW_INVENTORY_ALERT_TYPE = "inventory.low";
const LOW_PRODUCT_STOCK_ALERT_TYPE = "product.low";
const DEFAULT_PRODUCT_STOCK_THRESHOLD = 5;

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

const buildProductAlertMessage = (product, threshold = DEFAULT_PRODUCT_STOCK_THRESHOLD) =>
  `${product.name} is low on stock (${product.stock} left, alert threshold ${threshold}).`;

const createProductAlertMeta = (product, threshold = DEFAULT_PRODUCT_STOCK_THRESHOLD) => ({
  productName: product.name,
  productId: product.id,
  currentStock: product.stock,
  threshold,
  categoryId: product.categoryId,
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

const syncProductStockAlertWithClient = async (
  client,
  product,
  threshold = DEFAULT_PRODUCT_STOCK_THRESHOLD
) => {
  const entityId = String(product.id);
  const normalizedThreshold = Math.max(Number(threshold) || DEFAULT_PRODUCT_STOCK_THRESHOLD, 0);
  const isLow = Number(product.stock) <= normalizedThreshold;
  const existingOpenAlert = await client.systemAlert.findFirst({
    where: {
      type: LOW_PRODUCT_STOCK_ALERT_TYPE,
      entityType: "product",
      entityId,
      status: "open",
    },
  });

  if (isLow) {
    const payload = {
      type: LOW_PRODUCT_STOCK_ALERT_TYPE,
      severity: Number(product.stock) === 0 ? "critical" : "warning",
      title: `Low stock: ${product.name}`,
      message: buildProductAlertMessage(product, normalizedThreshold),
      status: "open",
      entityType: "product",
      entityId,
      meta: createProductAlertMeta(product, normalizedThreshold),
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

const syncProductStockAlert = async (
  product,
  threshold = DEFAULT_PRODUCT_STOCK_THRESHOLD,
  tx = prisma
) => {
  if (!product) {
    return;
  }

  if (product.deletedAt) {
    await resolveProductStockAlert(product.id, tx);
    return;
  }

  await syncProductStockAlertWithClient(tx, product, threshold);
};

const resolveProductStockAlert = async (productId, tx = prisma) => {
  if (!productId) {
    return;
  }

  const existingOpenAlert = await tx.systemAlert.findFirst({
    where: {
      type: LOW_PRODUCT_STOCK_ALERT_TYPE,
      entityType: "product",
      entityId: String(productId),
      status: "open",
    },
  });

  if (!existingOpenAlert) {
    return;
  }

  await tx.systemAlert.update({
    where: { id: existingOpenAlert.id },
    data: {
      status: "resolved",
      resolvedAt: new Date(),
    },
  });

  triggerAlertRefresh();
};

const refreshAllInventoryAlerts = async () => {
  try {
    const [items, products] = await Promise.all([
      prisma.inventory.findMany(),
      prisma.product.findMany({
        where: {
          deletedAt: null,
        },
      }),
    ]);

    for (const item of items) {
      // Sequential updates keep the logic simple and the data consistent.
      await syncInventoryAlert(item, prisma);
    }

    for (const product of products) {
      await syncProductStockAlert(product, DEFAULT_PRODUCT_STOCK_THRESHOLD, prisma);
    }

    return {
      ok: true,
      count: items.length + products.length,
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
  DEFAULT_PRODUCT_STOCK_THRESHOLD,
  getSystemAlerts,
  isDatabaseUnavailableError,
  refreshAllInventoryAlerts,
  resolveProductStockAlert,
  syncInventoryAlert,
  syncProductStockAlert,
};
