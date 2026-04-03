const prisma = require("../../config/prisma");
const AppError = require("../../utils/app-error");
const { handleControllerError, sendSuccess } = require("../../utils/response");

const DASHBOARD_ORDER_INCLUDE = {
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
    orderBy: { id: "asc" },
  },
};

const toStartOfDay = (date) => {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

const toEndExclusiveDay = (date) => {
  const nextDate = toStartOfDay(date);
  nextDate.setDate(nextDate.getDate() + 1);
  return nextDate;
};

const parseDateInput = (value, label) => {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new AppError(`${label} must be a valid date`);
  }

  return parsedDate;
};

const parsePositiveInteger = (value, fallback) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = Number(value);

  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new AppError("Value must be a positive integer");
  }

  return normalized;
};

const buildDateRange = (query, options = {}) => {
  const fromValue = query.from || query.startDate || null;
  const toValue = query.to || query.endDate || null;
  const defaultDays = options.defaultDays || 1;
  const now = new Date();

  if (!fromValue && !toValue) {
    const start = toStartOfDay(now);
    start.setDate(start.getDate() - (defaultDays - 1));
    return {
      from: start,
      to: toEndExclusiveDay(now),
    };
  }

  const fromDate = fromValue ? parseDateInput(fromValue, "from") : now;
  const toDate = toValue ? parseDateInput(toValue, "to") : fromDate;
  const from = toStartOfDay(fromDate);
  const to = toEndExclusiveDay(toDate);

  if (to <= from) {
    throw new AppError("to must be greater than or equal to from");
  }

  return { from, to };
};

const formatDateKey = (date) => date.toISOString().slice(0, 10);

const buildRangeFilter = (field, range) => ({
  [field]: {
    gte: range.from,
    lt: range.to,
  },
});

exports.getDashboardStats = async (req, res) => {
  try {
    const range = buildDateRange(req.query, { defaultDays: 1 });
    const openOrderStatuses = ["pending", "preparing", "served", "pending_payment"];

    const [
      totalProducts,
      totalCategories,
      totalOrders,
      totalPendingOrders,
      totalCompletedOrders,
      totalRevenueAggregation,
      activeTables,
      periodOrders,
      periodPaidOrders,
      periodRevenueAggregation,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.category.count(),
      prisma.order.count(),
      prisma.order.count({
        where: {
          status: {
            in: openOrderStatuses,
          },
        },
      }),
      prisma.order.count({
        where: { status: "paid" },
      }),
      prisma.order.aggregate({
        where: { status: "paid" },
        _sum: { total: true },
      }),
      prisma.table.count({
        where: {
          status: {
            in: ["occupied", "pending_payment"],
          },
        },
      }),
      prisma.order.count({
        where: buildRangeFilter("createdAt", range),
      }),
      prisma.order.count({
        where: {
          status: "paid",
          ...buildRangeFilter("updatedAt", range),
        },
      }),
      prisma.order.aggregate({
        where: {
          status: "paid",
          ...buildRangeFilter("updatedAt", range),
        },
        _sum: { total: true },
      }),
    ]);

    const periodRevenue = Number((periodRevenueAggregation._sum.total || 0).toFixed(2));
    const averageOrderValue =
      periodPaidOrders > 0 ? Number((periodRevenue / periodPaidOrders).toFixed(2)) : 0;

    return sendSuccess(res, 200, "Dashboard statistics retrieved successfully", {
      totalProducts,
      totalCategories,
      totalOrders,
      totalRevenue: Number((totalRevenueAggregation._sum.total || 0).toFixed(2)),
      totalPendingOrders,
      totalCompletedOrders,
      activeTables,
      periodStart: range.from.toISOString(),
      periodEnd: range.to.toISOString(),
      todayOrders: periodOrders,
      todayRevenue: periodRevenue,
      averageOrderValue,
    });
  } catch (error) {
    return handleControllerError(res, error, "Get dashboard stats error");
  }
};

exports.getTopProducts = async (req, res) => {
  try {
    const groupedItems = await prisma.orderItem.groupBy({
      where: {
        order: {
          status: "paid",
        },
      },
      by: ["productId"],
      _sum: {
        quantity: true,
      },
      orderBy: {
        _sum: {
          quantity: "desc",
        },
      },
      take: 5,
    });

    if (groupedItems.length === 0) {
      return sendSuccess(res, 200, "Top products retrieved successfully", []);
    }

    const products = await prisma.product.findMany({
      where: {
        id: {
          in: groupedItems.map((item) => item.productId),
        },
      },
      include: {
        category: true,
      },
    });

    const productsById = new Map(products.map((product) => [product.id, product]));

    const topProducts = groupedItems
      .map((item) => {
        const product = productsById.get(item.productId);

        if (!product) {
          return null;
        }

        return {
          product,
          totalQuantitySold: item._sum.quantity || 0,
        };
      })
      .filter(Boolean);

    return sendSuccess(res, 200, "Top products retrieved successfully", topProducts);
  } catch (error) {
    return handleControllerError(res, error, "Get top products error");
  }
};

exports.getRecentOrders = async (req, res) => {
  try {
    const recentOrders = await prisma.order.findMany({
      include: DASHBOARD_ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return sendSuccess(res, 200, "Recent orders retrieved successfully", recentOrders);
  } catch (error) {
    return handleControllerError(res, error, "Get recent orders error");
  }
};

exports.getOrdersByDate = async (req, res) => {
  try {
    const range = buildDateRange(req.query, { defaultDays: 1 });
    const status =
      typeof req.query.status === "string" && req.query.status.trim()
        ? req.query.status.trim().toLowerCase()
        : null;
    const limit = Math.min(parsePositiveInteger(req.query.limit, 100), 300);

    const where = {
      ...buildRangeFilter("createdAt", range),
      ...(status ? { status } : {}),
    };

    const [orders, paidAggregation] = await Promise.all([
      prisma.order.findMany({
        where,
        include: DASHBOARD_ORDER_INCLUDE,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.order.aggregate({
        where: {
          ...where,
          status: "paid",
        },
        _sum: { total: true },
        _count: { id: true },
      }),
    ]);

    const paidRevenue = Number((paidAggregation._sum.total || 0).toFixed(2));
    const paidCount = paidAggregation._count.id || 0;
    const averagePaidOrder =
      paidCount > 0 ? Number((paidRevenue / paidCount).toFixed(2)) : 0;

    return sendSuccess(res, 200, "Orders retrieved successfully", {
      filters: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        status: status || "all",
        limit,
      },
      summary: {
        orderCount: orders.length,
        paidRevenue,
        paidOrders: paidCount,
        averagePaidOrder,
      },
      orders,
    });
  } catch (error) {
    return handleControllerError(res, error, "Get orders by date error");
  }
};

exports.getRevenueTrend = async (req, res) => {
  try {
    const days = Math.min(parsePositiveInteger(req.query.days, 7), 60);
    const endDate = new Date();
    const startDate = toStartOfDay(endDate);
    startDate.setDate(startDate.getDate() - (days - 1));
    const endExclusive = toEndExclusiveDay(endDate);

    const paidOrders = await prisma.order.findMany({
      where: {
        status: "paid",
        ...buildRangeFilter("updatedAt", { from: startDate, to: endExclusive }),
      },
      select: {
        id: true,
        total: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: "asc",
      },
    });

    const buckets = {};
    for (let index = 0; index < days; index += 1) {
      const day = new Date(startDate);
      day.setDate(day.getDate() + index);
      const key = formatDateKey(day);
      buckets[key] = { date: key, revenue: 0, orders: 0 };
    }

    paidOrders.forEach((order) => {
      const key = formatDateKey(order.updatedAt);
      if (!buckets[key]) {
        return;
      }

      buckets[key].revenue = Number((buckets[key].revenue + order.total).toFixed(2));
      buckets[key].orders += 1;
    });

    return sendSuccess(
      res,
      200,
      "Revenue trend retrieved successfully",
      Object.values(buckets)
    );
  } catch (error) {
    return handleControllerError(res, error, "Get revenue trend error");
  }
};

exports.getWaiterPerformance = async (req, res) => {
  try {
    const range = buildDateRange(req.query, { defaultDays: 1 });

    const grouped = await prisma.order.groupBy({
      where: {
        status: "paid",
        ...buildRangeFilter("updatedAt", range),
      },
      by: ["userId"],
      _sum: {
        total: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _sum: {
          total: "desc",
        },
      },
    });

    const userIds = grouped
      .map((entry) => entry.userId)
      .filter((value) => Number.isInteger(value));

    const users = userIds.length
      ? await prisma.user.findMany({
          where: {
            id: {
              in: userIds,
            },
          },
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        })
      : [];

    const usersById = new Map(users.map((user) => [user.id, user]));

    const performance = grouped.map((entry, index) => {
      const user = usersById.get(entry.userId);
      const totalSales = Number((entry._sum.total || 0).toFixed(2));
      const ordersHandled = entry._count.id || 0;

      return {
        rank: index + 1,
        userId: entry.userId || null,
        waiterName: user ? user.fullName : "Unknown user",
        email: user ? user.email : null,
        totalSales,
        ordersHandled,
        averageOrderValue:
          ordersHandled > 0 ? Number((totalSales / ordersHandled).toFixed(2)) : 0,
      };
    });

    return sendSuccess(res, 200, "Waiter performance retrieved successfully", {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      ranking: performance,
    });
  } catch (error) {
    return handleControllerError(res, error, "Get waiter performance error");
  }
};

exports.getInvoices = async (req, res) => {
  try {
    const range = buildDateRange(req.query, { defaultDays: 1 });
    const limit = Math.min(parsePositiveInteger(req.query.limit, 100), 300);

    const invoices = await prisma.order.findMany({
      where: {
        status: {
          in: ["pending_payment", "paid"],
        },
        ...buildRangeFilter("updatedAt", range),
      },
      include: DASHBOARD_ORDER_INCLUDE,
      orderBy: {
        updatedAt: "desc",
      },
      take: limit,
    });

    const mappedInvoices = invoices.map((order) => ({
      ...order,
      receiptUrl: `/api/orders/${order.id}/receipt`,
    }));

    return sendSuccess(res, 200, "Invoices retrieved successfully", {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      count: mappedInvoices.length,
      invoices: mappedInvoices,
    });
  } catch (error) {
    return handleControllerError(res, error, "Get invoices error");
  }
};

exports.getDailySummary = async (req, res) => {
  try {
    const date = req.query.date ? parseDateInput(req.query.date, "date") : new Date();
    const from = toStartOfDay(date);
    const to = toEndExclusiveDay(date);

    const [paidAggregation, totalOrders, expensesAggregation] = await Promise.all([
      prisma.order.aggregate({
        where: {
          status: "paid",
          ...buildRangeFilter("updatedAt", { from, to }),
        },
        _sum: {
          total: true,
        },
        _count: {
          id: true,
        },
      }),
      prisma.order.count({
        where: buildRangeFilter("createdAt", { from, to }),
      }),
      prisma.expense.aggregate({
        where: buildRangeFilter("date", { from, to }),
        _sum: {
          amount: true,
        },
      }),
    ]);

    const totalRevenue = Number((paidAggregation._sum.total || 0).toFixed(2));
    const totalExpenses = Number((expensesAggregation._sum.amount || 0).toFixed(2));
    const paidOrders = paidAggregation._count.id || 0;

    return sendSuccess(res, 200, "Daily summary retrieved successfully", {
      date: formatDateKey(from),
      totalRevenue,
      totalExpenses,
      netRevenue: Number((totalRevenue - totalExpenses).toFixed(2)),
      totalOrders,
      paidOrders,
      averagePaidOrder:
        paidOrders > 0 ? Number((totalRevenue / paidOrders).toFixed(2)) : 0,
    });
  } catch (error) {
    return handleControllerError(res, error, "Get daily summary error");
  }
};

exports.getLowStockProducts = async (req, res) => {
  try {
    const threshold = parsePositiveInteger(req.query.threshold, 5);

    const products = await prisma.product.findMany({
      where: {
        stock: {
          lte: threshold,
        },
      },
      include: {
        category: true,
      },
      orderBy: [{ stock: "asc" }, { name: "asc" }],
    });

    return sendSuccess(res, 200, "Low stock products retrieved successfully", {
      threshold,
      count: products.length,
      products,
    });
  } catch (error) {
    return handleControllerError(res, error, "Get low stock products error");
  }
};
