const bcrypt = require("bcryptjs");
const { randomBytes } = require("crypto");

const prisma = require("../../config/prisma");
const { publishRealtimeEvent } = require("../../services/realtime.service");
const AppError = require("../../utils/app-error");
const { getReachableAppBaseUrl } = require("../../utils/network");
const { handleControllerError, sendSuccess } = require("../../utils/response");

const ACTIVE_ORDER_STATUSES = ["pending", "preparing", "served", "pending_payment"];
const EDITABLE_ORDER_STATUSES = ["pending", "preparing", "served"];
const GUEST_USER_EMAIL = "guest.orders@system.local";

const parseTableId = (value) => {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("Valid table id is required");
  }

  return id;
};

const validateGuestItems = (payload) => {
  if (!Array.isArray(payload?.items) || payload.items.length === 0) {
    throw new AppError("At least one item is required");
  }

  return payload.items.map((item, index) => {
    const productId = Number(item?.productId);
    const quantity = Number(item?.quantity);

    if (!Number.isInteger(productId) || productId <= 0) {
      throw new AppError(`Item ${index + 1} has invalid productId`);
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new AppError(`Item ${index + 1} has invalid quantity`);
    }

    return { productId, quantity };
  });
};

const generateGuestAccessToken = () => randomBytes(24).toString("hex");

const ensureGuestOrderUser = async (tx) => {
  const password = await bcrypt.hash(randomBytes(12).toString("hex"), 10);

  return tx.user.upsert({
    where: {
      email: GUEST_USER_EMAIL,
    },
    update: {
      status: "active",
      role: "guest",
      fullName: "QR Guest Orders",
    },
    create: {
      fullName: "QR Guest Orders",
      email: GUEST_USER_EMAIL,
      password,
      role: "guest",
      status: "active",
    },
    select: {
      id: true,
    },
  });
};

const getActiveAccessToken = (tableId) =>
  prisma.tableAccessToken.findFirst({
    where: {
      tableId,
      status: "active",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

const ensureTableAccess = async (token) => {
  const access = await prisma.tableAccessToken.findFirst({
    where: {
      token,
      status: "active",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      table: true,
    },
  });

  if (!access) {
    throw new AppError("QR access token is invalid or expired", 404);
  }

  return access;
};

const buildOrderItems = (products, normalizedItems) => {
  const productsById = new Map(products.map((product) => [product.id, product]));
  let total = 0;

  const orderItems = normalizedItems.map((item) => {
    const product = productsById.get(item.productId);

    if (!product) {
      throw new AppError(`Product with id ${item.productId} was not found`, 404);
    }

    if (!product.isAvailable) {
      throw new AppError(`Product "${product.name}" is not available`);
    }

    if (Number(product.stock) < item.quantity) {
      throw new AppError(`Not enough stock for "${product.name}"`);
    }

    total += Number(product.price) * item.quantity;

    return {
      productId: product.id,
      quantity: item.quantity,
      price: product.price,
    };
  });

  return {
    orderItems,
    total: Number(total.toFixed(2)),
  };
};

const deductStockForOrderItems = async (tx, orderItems) => {
  for (const item of orderItems) {
    const updated = await tx.product.updateMany({
      where: {
        id: item.productId,
        stock: {
          gte: item.quantity,
        },
      },
      data: {
        stock: {
          decrement: item.quantity,
        },
      },
    });

    if (updated.count === 0) {
      throw new AppError("Stock changed while saving the guest order. Please retry.");
    }
  }
};

const guestOrderInclude = {
  table: true,
  items: {
    include: {
      product: {
        include: {
          category: true,
        },
      },
    },
    orderBy: {
      id: "asc",
    },
  },
};

const buildGuestAccessPayload = (req, table, access) => {
  const localBaseUrl = `${req.protocol}://${req.get("host")}`;
  const reachableBaseUrl = getReachableAppBaseUrl(req);

  return {
    table,
    token: access.token,
    expiresAt: access.expiresAt,
    guestOrderUrl: `${reachableBaseUrl}/guest/table/${access.token}`,
    localGuestOrderUrl: `${localBaseUrl}/guest/table/${access.token}`,
  };
};

exports.getTableGuestAccess = async (req, res) => {
  try {
    const tableId = parseTableId(req.params.tableId);
    const table = await prisma.table.findUnique({
      where: { id: tableId },
    });

    if (!table) {
      throw new AppError("Table not found", 404);
    }

    let access = await getActiveAccessToken(tableId);

    if (!access) {
      access = await prisma.tableAccessToken.create({
        data: {
          tableId,
          token: generateGuestAccessToken(),
        },
      });
    }

    return sendSuccess(
      res,
      200,
      "Guest QR access prepared successfully",
      buildGuestAccessPayload(req, table, access)
    );
  } catch (error) {
    return handleControllerError(res, error, "Get guest table access error");
  }
};

exports.rotateTableGuestAccess = async (req, res) => {
  try {
    const tableId = parseTableId(req.params.tableId);
    const table = await prisma.table.findUnique({
      where: { id: tableId },
    });

    if (!table) {
      throw new AppError("Table not found", 404);
    }

    await prisma.tableAccessToken.updateMany({
      where: {
        tableId,
        status: "active",
      },
      data: {
        status: "revoked",
      },
    });

    const access = await prisma.tableAccessToken.create({
      data: {
        tableId,
        token: generateGuestAccessToken(),
      },
    });

    return sendSuccess(
      res,
      201,
      "Guest QR token rotated successfully",
      buildGuestAccessPayload(req, table, access)
    );
  } catch (error) {
    return handleControllerError(res, error, "Rotate guest table access error");
  }
};

exports.getGuestMenu = async (req, res) => {
  try {
    const access = await ensureTableAccess(String(req.params.token || "").trim());

    const [categories, products] = await Promise.all([
      prisma.category.findMany({
        orderBy: { name: "asc" },
      }),
      prisma.product.findMany({
        where: {
          isAvailable: true,
          stock: {
            gt: 0,
          },
        },
        include: {
          category: true,
        },
        orderBy: { name: "asc" },
      }),
    ]);

    const categoryIds = new Set(products.map((product) => product.categoryId));

    return sendSuccess(res, 200, "Guest menu retrieved successfully", {
      table: access.table,
      token: access.token,
      categories: categories.filter((category) => categoryIds.has(category.id)),
      products,
    });
  } catch (error) {
    return handleControllerError(res, error, "Get guest menu error");
  }
};

exports.submitGuestOrder = async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    const items = validateGuestItems(req.body);
    const access = await ensureTableAccess(token);

    const { savedOrder, appendedToExistingOrder, itemCount } = await prisma.$transaction(async (tx) => {
      const [guestUser, products, activeOrder] = await Promise.all([
        ensureGuestOrderUser(tx),
        tx.product.findMany({
          where: {
            id: {
              in: items.map((item) => item.productId),
            },
          },
        }),
        tx.order.findFirst({
          where: {
            tableId: access.tableId,
            status: {
              in: ACTIVE_ORDER_STATUSES,
            },
          },
          include: guestOrderInclude,
          orderBy: {
            createdAt: "desc",
          },
        }),
      ]);

      const { orderItems, total } = buildOrderItems(products, items);
      const itemCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);

      if (activeOrder && !EDITABLE_ORDER_STATUSES.includes(activeOrder.status)) {
        throw new AppError("The current bill is already in payment stage. Please ask staff for help.");
      }

      await deductStockForOrderItems(tx, orderItems);

      if (activeOrder) {
        await tx.orderItem.createMany({
          data: orderItems.map((item) => ({
            orderId: activeOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          })),
        });

        return {
          appendedToExistingOrder: true,
          itemCount,
          savedOrder: await tx.order.update({
            where: {
              id: activeOrder.id,
            },
            data: {
              total: Number((activeOrder.total + total).toFixed(2)),
            },
            include: guestOrderInclude,
          }),
        };
      }

      await tx.table.update({
        where: {
          id: access.tableId,
        },
        data: {
          status: "occupied",
        },
      });

      return {
        appendedToExistingOrder: false,
        itemCount,
        savedOrder: await tx.order.create({
          data: {
            userId: guestUser.id,
            tableId: access.tableId,
            paymentMethod: "guest_qr",
            total,
            status: "pending",
            items: {
              create: orderItems,
            },
          },
          include: guestOrderInclude,
        }),
      };
    });

    publishRealtimeEvent(["orders", "tables", "dashboard"], {
      type: "guest-order.created",
      eventId: `guest-order-${savedOrder.id}-${Date.now()}`,
      orderId: savedOrder.id,
      tableId: savedOrder.tableId,
      tableNumber: savedOrder.table?.number || null,
      location: savedOrder.table?.location || "",
      assignedWaiterId: savedOrder.table?.assignedWaiterId || null,
      itemCount,
      total: Number(savedOrder.total || 0),
      appendedToExistingOrder,
    });

    return sendSuccess(res, 201, "Guest order saved successfully", savedOrder);
  } catch (error) {
    return handleControllerError(res, error, "Submit guest order error");
  }
};
