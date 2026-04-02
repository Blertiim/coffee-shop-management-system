const prisma = require("../../config/prisma");

const VALID_ORDER_STATUSES = new Set(["pending", "completed", "cancelled"]);

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
  items: {
    include: {
      product: {
        include: { category: true },
      },
    },
    orderBy: { id: "asc" },
  },
};

class OrderValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "OrderValidationError";
    this.statusCode = statusCode;
  }
}

const parseId = (value) => {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
};

const parseQuantity = (value) => {
  const quantity = Number(value);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return null;
  }

  return quantity;
};

const normalizeStatus = (value) => {
  if (value === undefined) {
    return "pending";
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (!normalizedValue || !VALID_ORDER_STATUSES.has(normalizedValue)) {
    return null;
  }

  return normalizedValue;
};

const normalizeItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new OrderValidationError("Order items are required");
  }

  const normalizedItems = items.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new OrderValidationError(
        `Order item at position ${index + 1} must be an object`
      );
    }

    const productId = parseId(item.productId);
    const quantity = parseQuantity(item.quantity);

    if (!productId || !quantity) {
      throw new OrderValidationError(
        `Order item at position ${index + 1} must include a valid productId and quantity`
      );
    }

    return { productId, quantity };
  });

  const uniqueProductIds = new Set(normalizedItems.map((item) => item.productId));

  if (uniqueProductIds.size !== normalizedItems.length) {
    throw new OrderValidationError("Each product can only appear once per order");
  }

  return normalizedItems;
};

const mapOrderData = (productsById, items) => {
  let total = 0;

  const orderItems = items.map((item) => {
    const product = productsById.get(item.productId);

    if (!product) {
      throw new OrderValidationError(
        `Product with id ${item.productId} was not found`,
        404
      );
    }

    if (!product.isAvailable) {
      throw new OrderValidationError(
        `Product "${product.name}" is not available for ordering`
      );
    }

    if (product.stock < item.quantity) {
      throw new OrderValidationError(
        `Not enough stock for product "${product.name}"`
      );
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

const getAuthenticatedUserId = (req) => parseId(req.user && req.user.id);
const isAdminUser = (req) =>
  req.user &&
  typeof req.user.role === "string" &&
  req.user.role.trim().toLowerCase() === "admin";

exports.createOrder = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const items = normalizeItems(req.body.items);
    const status = normalizeStatus(req.body.status);

    if (!userId) {
      return res.status(401).json({ error: "Invalid authenticated user" });
    }

    if (!status) {
      return res.status(400).json({
        error: "Status must be one of: pending, completed, cancelled",
      });
    }

    const createdOrder = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new OrderValidationError("Authenticated user not found", 404);
      }

      const products = await tx.product.findMany({
        where: {
          id: { in: items.map((item) => item.productId) },
        },
      });

      const productsById = new Map(products.map((product) => [product.id, product]));
      const { orderItems, total } = mapOrderData(productsById, items);

      for (const item of orderItems) {
        const updatedProduct = await tx.product.updateMany({
          where: {
            id: item.productId,
            stock: { gte: item.quantity },
          },
          data: {
            stock: { decrement: item.quantity },
          },
        });

        if (updatedProduct.count === 0) {
          const product = productsById.get(item.productId);

          throw new OrderValidationError(
            `Not enough stock for product "${product.name}"`
          );
        }
      }

      return tx.order.create({
        data: {
          userId,
          total,
          status,
          items: {
            create: orderItems,
          },
        },
        include: orderInclude,
      });
    });

    res.status(201).json({
      message: "Order created successfully",
      order: createdOrder,
    });
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error("Create order error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: orderInclude,
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(orders);
  } catch (error) {
    console.error("Get all orders error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({ error: "Invalid authenticated user" });
    }

    const orders = await prisma.order.findMany({
      where: { userId },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(orders);
  } catch (error) {
    console.error("Get my orders error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const userId = getAuthenticatedUserId(req);

    if (!id) {
      return res.status(400).json({ error: "Invalid order id" });
    }

    if (!userId) {
      return res.status(401).json({ error: "Invalid authenticated user" });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (!isAdminUser(req) && order.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.status(200).json(order);
  } catch (error) {
    console.error("Get order by id error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const status = normalizeStatus(req.body.status);

    if (!id) {
      return res.status(400).json({ error: "Invalid order id" });
    }

    if (!status) {
      return res.status(400).json({
        error: "Status must be one of: pending, completed, cancelled",
      });
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findUnique({
        where: { id },
        include: {
          items: true,
        },
      });

      if (!existingOrder) {
        throw new OrderValidationError("Order not found", 404);
      }

      if (existingOrder.status === "cancelled" && status !== "cancelled") {
        throw new OrderValidationError(
          "Cancelled orders cannot change status"
        );
      }

      if (existingOrder.status !== "cancelled" && status === "cancelled") {
        for (const item of existingOrder.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { increment: item.quantity },
            },
          });
        }
      }

      return tx.order.update({
        where: { id },
        data: { status },
        include: orderInclude,
      });
    });

    res.status(200).json({
      message: "Order status updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error("Update order status error:", error);
    res.status(500).json({ error: "Server error" });
  }
};
