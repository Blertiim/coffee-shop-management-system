const prisma = require("../../config/prisma");
const AppError = require("../../utils/app-error");
const { handleControllerError, sendError, sendSuccess } = require("../../utils/response");
const { normalizeRole } = require("../../middlewares/role.middleware");
const {
  validateCreateOrderPayload,
  validateAppendOrderItemsPayload,
  validateOrderId,
  validateTableId,
  validateOrderStatusUpdatePayload,
} = require("./order.validation");

const ORDER_PROGRESS_FLOW = {
  pending: "preparing",
  preparing: "served",
  served: "paid",
};

const ACTIVE_ORDER_STATUSES = ["pending", "preparing", "served"];

const orderInclude = {
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      status: true,
    },
  },
  table: true,
  employee: true,
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

const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const isAdmin = (req) => normalizeRole(req.user && req.user.role) === "admin";
const isWaiter = (req) => normalizeRole(req.user && req.user.role) === "waiter";

const isAssignedWaiter = (req, order) =>
  isWaiter(req) &&
  order &&
  order.employee &&
  normalizeEmail(order.employee.email) === normalizeEmail(req.user && req.user.email);

const canAccessOrder = (req, order) => {
  const userId = req.user && req.user.id;

  if (!userId || !order) {
    return false;
  }

  return isAdmin(req) || order.userId === userId || isAssignedWaiter(req, order);
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
      throw new AppError(`Product "${product.name}" is not available for ordering`);
    }

    if (product.stock < item.quantity) {
      throw new AppError(`Not enough stock for product "${product.name}"`);
    }

    total += product.price * item.quantity;

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

const restoreStockForOrder = async (tx, items) => {
  for (const item of items) {
    await tx.product.update({
      where: { id: item.productId },
      data: {
        stock: {
          increment: item.quantity,
        },
      },
    });
  }
};

const deductStockForOrderItems = async (tx, orderItems) => {
  for (const item of orderItems) {
    const updatedProduct = await tx.product.updateMany({
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

    if (updatedProduct.count === 0) {
      throw new AppError("Stock changed while creating the order. Please try again.");
    }
  }
};

exports.createOrder = async (req, res) => {
  try {
    const userId = req.user && req.user.id;

    if (!userId) {
      return sendError(res, 401, "Invalid authenticated user");
    }

    const { items, tableId, employeeId, paymentMethod } =
      validateCreateOrderPayload(req.body);

    const createdOrder = await prisma.$transaction(async (tx) => {
      const [table, employee, products, activeOrderOnTable] = await Promise.all([
        tx.table.findUnique({
          where: { id: tableId },
        }),
        tx.employee.findUnique({
          where: { id: employeeId },
        }),
        tx.product.findMany({
          where: {
            id: {
              in: items.map((item) => item.productId),
            },
          },
        }),
        tx.order.findFirst({
          where: {
            tableId,
            status: {
              in: ACTIVE_ORDER_STATUSES,
            },
          },
        }),
      ]);

      if (!table) {
        throw new AppError("Table not found", 404);
      }

      if (table.status === "occupied" || activeOrderOnTable) {
        throw new AppError("Table is already occupied");
      }

      if (!employee) {
        throw new AppError("Assigned employee not found", 404);
      }

      if (employee.position !== "waiter") {
        throw new AppError("Orders can only be assigned to employees with waiter position");
      }

      const waiterUser = await tx.user.findFirst({
        where: {
          email: employee.email,
          role: "waiter",
          status: "active",
        },
        select: {
          id: true,
        },
      });

      if (!waiterUser) {
        throw new AppError("Assigned waiter must have an active waiter user account");
      }

      const { orderItems, total } = buildOrderItems(products, items);

      await deductStockForOrderItems(tx, orderItems);

      await tx.table.update({
        where: { id: tableId },
        data: {
          status: "occupied",
        },
      });

      return tx.order.create({
        data: {
          userId,
          tableId,
          employeeId,
          paymentMethod,
          total,
          status: "pending",
          items: {
            create: orderItems,
          },
        },
        include: orderInclude,
      });
    });

    return sendSuccess(res, 201, "Order created successfully", createdOrder);
  } catch (error) {
    return handleControllerError(res, error, "Create order error");
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: orderInclude,
      orderBy: {
        createdAt: "desc",
      },
    });

    return sendSuccess(res, 200, "Orders retrieved successfully", orders);
  } catch (error) {
    return handleControllerError(res, error, "Get all orders error");
  }
};

exports.getActiveOrderByTable = async (req, res) => {
  try {
    const tableId = validateTableId(req.params.tableId);
    const userId = req.user && req.user.id;

    if (!userId) {
      return sendError(res, 401, "Invalid authenticated user");
    }

    const activeOrder = await prisma.order.findFirst({
      where: {
        tableId,
        status: {
          in: ACTIVE_ORDER_STATUSES,
        },
      },
      include: orderInclude,
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!activeOrder) {
      return sendError(res, 404, "No active order found for this table");
    }

    if (!canAccessOrder(req, activeOrder)) {
      return sendError(res, 403, "Access denied");
    }

    return sendSuccess(res, 200, "Active order retrieved successfully", activeOrder);
  } catch (error) {
    return handleControllerError(res, error, "Get active order by table error");
  }
};

exports.appendItemsToOrder = async (req, res) => {
  try {
    const id = validateOrderId(req.params.id);
    const { items } = validateAppendOrderItemsPayload(req.body);

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findUnique({
        where: { id },
        include: orderInclude,
      });

      if (!existingOrder) {
        throw new AppError("Order not found", 404);
      }

      if (!canAccessOrder(req, existingOrder)) {
        throw new AppError("Access denied", 403);
      }

      if (existingOrder.status === "cancelled" || existingOrder.status === "paid") {
        throw new AppError("Items cannot be added to this order");
      }

      const products = await tx.product.findMany({
        where: {
          id: {
            in: items.map((item) => item.productId),
          },
        },
      });

      const { orderItems, total } = buildOrderItems(products, items);
      await deductStockForOrderItems(tx, orderItems);

      await tx.orderItem.createMany({
        data: orderItems.map((item) => ({
          orderId: existingOrder.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
      });

      return tx.order.update({
        where: { id: existingOrder.id },
        data: {
          total: Number((existingOrder.total + total).toFixed(2)),
        },
        include: orderInclude,
      });
    });

    return sendSuccess(res, 200, "Items added to order successfully", updatedOrder);
  } catch (error) {
    return handleControllerError(res, error, "Append order items error");
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user && req.user.id;

    if (!userId) {
      return sendError(res, 401, "Invalid authenticated user");
    }

    const orders = await prisma.order.findMany({
      where: { userId },
      include: orderInclude,
      orderBy: {
        createdAt: "desc",
      },
    });

    return sendSuccess(res, 200, "Orders retrieved successfully", orders);
  } catch (error) {
    return handleControllerError(res, error, "Get my orders error");
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const id = validateOrderId(req.params.id);
    const userId = req.user && req.user.id;

    if (!userId) {
      return sendError(res, 401, "Invalid authenticated user");
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });

    if (!order) {
      return sendError(res, 404, "Order not found");
    }

    if (!canAccessOrder(req, order)) {
      return sendError(res, 403, "Access denied");
    }

    return sendSuccess(res, 200, "Order retrieved successfully", order);
  } catch (error) {
    return handleControllerError(res, error, "Get order by id error");
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const id = validateOrderId(req.params.id);
    const { status } = validateOrderStatusUpdatePayload(req.body);

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findUnique({
        where: { id },
        include: orderInclude,
      });

      if (!existingOrder) {
        throw new AppError("Order not found", 404);
      }

      if (existingOrder.status === status) {
        throw new AppError(`Order is already ${status}`);
      }

      if (status === "cancelled") {
        if (!isAdmin(req)) {
          throw new AppError("Only admin can cancel orders", 403);
        }

        await restoreStockForOrder(tx, existingOrder.items);

        if (existingOrder.tableId) {
          await tx.table.update({
            where: { id: existingOrder.tableId },
            data: {
              status: "available",
            },
          });
        }

        return tx.order.update({
          where: { id },
          data: {
            status: "cancelled",
          },
          include: orderInclude,
        });
      }

      if (existingOrder.status === "cancelled") {
        throw new AppError("Cancelled orders cannot change status");
      }

      if (existingOrder.status === "paid") {
        throw new AppError("Paid orders cannot change status");
      }

      if (!isAssignedWaiter(req, existingOrder)) {
        throw new AppError("Only the assigned waiter can update this order", 403);
      }

      const nextAllowedStatus = ORDER_PROGRESS_FLOW[existingOrder.status];

      if (!nextAllowedStatus || status !== nextAllowedStatus) {
        throw new AppError(
          `Order status can only move from ${existingOrder.status} to ${nextAllowedStatus}`
        );
      }

      if (status === "paid" && existingOrder.tableId) {
        await tx.table.update({
          where: { id: existingOrder.tableId },
          data: {
            status: "available",
          },
        });
      }

      return tx.order.update({
        where: { id },
        data: {
          status,
        },
        include: orderInclude,
      });
    });

    return sendSuccess(
      res,
      200,
      "Order status updated successfully",
      updatedOrder
    );
  } catch (error) {
    return handleControllerError(res, error, "Update order status error");
  }
};
