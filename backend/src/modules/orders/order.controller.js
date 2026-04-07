const PDFDocument = require("pdfkit");
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
};

const ACTIVE_ORDER_STATUSES = ["pending", "preparing", "served", "pending_payment"];
const ITEM_EDITABLE_ORDER_STATUSES = ["pending", "preparing", "served"];
const RECEIPT_READY_STATUSES = ["pending_payment", "paid"];
const RECEIPT_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "short",
  timeStyle: "short",
});
const MONEY_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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
const isManager = (req) => normalizeRole(req.user && req.user.role) === "manager";
const isWaiter = (req) => normalizeRole(req.user && req.user.role) === "waiter";
const isAdminOrManager = (req) => isAdmin(req) || isManager(req);
const isPosStaff = (req) => isAdminOrManager(req) || isWaiter(req);

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

  return isPosStaff(req) || order.userId === userId || isAssignedWaiter(req, order);
};

const canManageOrderLifecycle = (req, order) => {
  const userId = req.user && req.user.id;

  if (!userId || !order) {
    return false;
  }

  return isPosStaff(req) || isAssignedWaiter(req, order) || order.userId === userId;
};

const normalizeStatus = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const formatMoney = (value) => MONEY_FORMATTER.format(Number(value || 0));

const buildReceiptFileName = (order) =>
  `coupon-order-${order.id}-${new Date().toISOString().slice(0, 10)}.pdf`;

const streamOrderReceiptPdf = (res, order) => {
  const doc = new PDFDocument({
    size: "A5",
    margin: 28,
  });

  doc.pipe(res);

  doc.fontSize(20).text("Cafe POS Coupon", { align: "center" });
  doc.moveDown(0.3);
  doc
    .fontSize(10)
    .fillColor("#555555")
    .text(`Order #${order.id}`, { align: "center" })
    .text(RECEIPT_DATE_FORMATTER.format(new Date(order.createdAt)), { align: "center" });

  doc.moveDown(1);
  doc.fillColor("#111111").fontSize(11);
  doc.text(`Table: ${order.table ? order.table.number : "-"}`);
  doc.text(
    `Waiter: ${
      order.employee
        ? `${order.employee.firstName} ${order.employee.lastName}`
        : order.user.fullName
    }`
  );
  doc.text(`Status: ${order.status}`);
  doc.text(`Payment: ${order.paymentMethod || "-"}`);
  doc.moveDown(0.8);

  doc.fontSize(10).text("Items", { underline: true });
  doc.moveDown(0.3);

  order.items.forEach((item, index) => {
    const lineTotal = item.price * item.quantity;

    doc
      .fontSize(10)
      .text(
        `${index + 1}. ${item.product ? item.product.name : "Product"} x${
          item.quantity
        }`,
        {
          continued: true,
        }
      )
      .text(` ${formatMoney(lineTotal)} EUR`, { align: "right" });
  });

  doc.moveDown(0.8);
  doc
    .fontSize(12)
    .text(`TOTAL: ${formatMoney(order.total)} EUR`, { align: "right" });

  doc.moveDown(1.2);
  doc
    .fontSize(9)
    .fillColor("#444444")
    .text("Thank you and enjoy your drinks.", { align: "center" });

  doc.end();
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

const setTableStatusForOrder = async (tx, order, status) => {
  if (!order.tableId) {
    return;
  }

  await tx.table.update({
    where: { id: order.tableId },
    data: { status },
  });
};

const applyOrderStatusTransition = async (tx, req, existingOrder, targetStatus) => {
  if (existingOrder.status === targetStatus) {
    throw new AppError(`Order is already ${targetStatus}`);
  }

  if (targetStatus === "cancelled") {
    if (!isAdminOrManager(req)) {
      throw new AppError("Only admin or manager can cancel orders", 403);
    }

    await restoreStockForOrder(tx, existingOrder.items);
    await setTableStatusForOrder(tx, existingOrder, "available");

    return tx.order.update({
      where: { id: existingOrder.id },
      data: { status: "cancelled" },
      include: orderInclude,
    });
  }

  if (existingOrder.status === "cancelled") {
    throw new AppError("Cancelled orders cannot change status");
  }

  if (existingOrder.status === "paid") {
    throw new AppError("Paid orders cannot change status");
  }

  if (targetStatus === "pending_payment") {
    if (!canManageOrderLifecycle(req, existingOrder)) {
      throw new AppError("Only POS staff or order owner can generate invoice", 403);
    }

    if (!ITEM_EDITABLE_ORDER_STATUSES.includes(existingOrder.status)) {
      throw new AppError("Invoice can only be generated for open orders");
    }

    await setTableStatusForOrder(tx, existingOrder, "pending_payment");

    return tx.order.update({
      where: { id: existingOrder.id },
      data: { status: "pending_payment" },
      include: orderInclude,
    });
  }

  if (targetStatus === "paid") {
    if (!canManageOrderLifecycle(req, existingOrder)) {
      throw new AppError("Only POS staff or order owner can complete payment", 403);
    }

    if (existingOrder.status !== "pending_payment") {
      throw new AppError(
        "Payment can only be completed after invoice generation",
        400
      );
    }

    await setTableStatusForOrder(tx, existingOrder, "available");

    return tx.order.update({
      where: { id: existingOrder.id },
      data: { status: "paid" },
      include: orderInclude,
    });
  }

  if (!canManageOrderLifecycle(req, existingOrder)) {
    throw new AppError("Only POS staff or order owner can update this order", 403);
  }

  const nextAllowedStatus = ORDER_PROGRESS_FLOW[existingOrder.status];

  if (!nextAllowedStatus || targetStatus !== nextAllowedStatus) {
    throw new AppError(
      `Order status can only move from ${existingOrder.status} to ${nextAllowedStatus}`
    );
  }

  await setTableStatusForOrder(tx, existingOrder, "occupied");

  return tx.order.update({
    where: { id: existingOrder.id },
    data: { status: targetStatus },
    include: orderInclude,
  });
};

const runOrderStatusUpdate = async (req, id, targetStatus) =>
  prisma.$transaction(async (tx) => {
    const existingOrder = await tx.order.findUnique({
      where: { id },
      include: orderInclude,
    });

    if (!existingOrder) {
      throw new AppError("Order not found", 404);
    }

    return applyOrderStatusTransition(tx, req, existingOrder, targetStatus);
  });

exports.createOrder = async (req, res) => {
  try {
    const userId = req.user && req.user.id;

    if (!userId) {
      return sendError(res, 401, "Invalid authenticated user");
    }

    const { items, tableId, employeeId, paymentMethod } = validateCreateOrderPayload(
      req.body
    );

    const createdOrder = await prisma.$transaction(async (tx) => {
      const [table, products, activeOrderOnTable] = await Promise.all([
        tx.table.findUnique({
          where: { id: tableId },
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

      const employee = employeeId
        ? await tx.employee.findUnique({
            where: { id: employeeId },
          })
        : null;

      if (!table) {
        throw new AppError("Table not found", 404);
      }

      const tableStatus = normalizeStatus(table.status);

      if (tableStatus === "occupied" || tableStatus === "pending_payment" || activeOrderOnTable) {
        throw new AppError("Table is already occupied");
      }

      if (employee && employee.position !== "waiter") {
        throw new AppError("Orders can only be assigned to employees with waiter position");
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
          employeeId: employee ? employee.id : null,
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

      if (!ITEM_EDITABLE_ORDER_STATUSES.includes(existingOrder.status)) {
        throw new AppError("Items can only be added while the order is open");
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

exports.getTodayPaidTotals = async (req, res) => {
  try {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const aggregates = await prisma.order.aggregate({
      where: {
        status: "paid",
        updatedAt: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
      _sum: {
        total: true,
      },
      _count: {
        id: true,
      },
    });

    const payload = {
      totalPaid: Number((aggregates._sum.total || 0).toFixed(2)),
      paidOrders: aggregates._count.id || 0,
      currency: "EUR",
      date: dayStart.toISOString().slice(0, 10),
    };

    return sendSuccess(
      res,
      200,
      "Today's paid totals retrieved successfully",
      payload
    );
  } catch (error) {
    return handleControllerError(res, error, "Get today's paid totals error");
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

exports.downloadOrderReceipt = async (req, res) => {
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

    if (!RECEIPT_READY_STATUSES.includes(order.status)) {
      return sendError(
        res,
        400,
        "Invoice is available only after the order is moved to pending payment"
      );
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${buildReceiptFileName(order)}"`
    );

    streamOrderReceiptPdf(res, order);
    return undefined;
  } catch (error) {
    return handleControllerError(res, error, "Download receipt error");
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const id = validateOrderId(req.params.id);
    const { status } = validateOrderStatusUpdatePayload(req.body);
    const updatedOrder = await runOrderStatusUpdate(req, id, status);

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

exports.generateInvoice = async (req, res) => {
  try {
    const id = validateOrderId(req.params.id);
    const updatedOrder = await runOrderStatusUpdate(req, id, "pending_payment");

    return sendSuccess(
      res,
      200,
      "Invoice generated. Order moved to pending payment",
      updatedOrder
    );
  } catch (error) {
    return handleControllerError(res, error, "Generate invoice error");
  }
};

exports.completePayment = async (req, res) => {
  try {
    const id = validateOrderId(req.params.id);
    const updatedOrder = await runOrderStatusUpdate(req, id, "paid");

    return sendSuccess(
      res,
      200,
      "Payment completed successfully",
      updatedOrder
    );
  } catch (error) {
    return handleControllerError(res, error, "Complete payment error");
  }
};
