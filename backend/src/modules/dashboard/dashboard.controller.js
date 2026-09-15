const PDFDocument = require("pdfkit");
const prisma = require("../../config/prisma");
const AppError = require("../../utils/app-error");
const {
  handleControllerError,
  sendError,
  sendSuccess,
} = require("../../utils/response");
const { ensureId } = require("../../utils/validation");
const { buildCacheKey, remember } = require("../../services/cache.service");
const {
  businessCalendarDate,
  businessDateKey,
  endOfBusinessDayExclusive,
  parseBusinessDate,
  startOfBusinessDay,
} = require("../../utils/business-day");

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

// Day boundaries come from the bar's timezone, not the server's clock - see
// utils/business-day.js for why that distinction matters in production.
const toStartOfDay = startOfBusinessDay;
const toEndExclusiveDay = endOfBusinessDayExclusive;

// DailyClosing.date is a calendar date column (@db.Date), which Prisma writes
// in UTC. A day's start instant (22:00Z the evening before, here) would store
// the previous calendar date, so the day being closed is converted to the UTC
// midnight that stands for the same calendar date.
const toCalendarDate = businessCalendarDate;

// Start of the business day N days before the given one. Steps day by day
// through the bar's calendar instead of subtracting 24-hour blocks, which
// would land an hour off once a DST change falls inside the range.
const toStartOfDaysAgo = (date, days) => {
  let cursor = toStartOfDay(date);

  for (let step = 0; step < days; step += 1) {
    cursor = toStartOfDay(new Date(cursor.getTime() - 12 * 60 * 60 * 1000));
  }

  return cursor;
};

const parseDateInput = (value, label) => {
  const parsedDate = parseBusinessDate(value);

  if (!parsedDate) {
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
    return {
      from: toStartOfDaysAgo(now, defaultDays - 1),
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

// Report labels and buckets are keyed by the bar's calendar day too, so an
// order taken at 00:30 lands on the day the staff calls it, and a day's bucket
// carries the date they expect to see on the chart.
const formatDateKey = businessDateKey;

const formatMonthKey = (date) => businessDateKey(date).slice(0, 7);

const buildRangeFilter = (field, range) => ({
  [field]: {
    gte: range.from,
    lt: range.to,
  },
});

const rememberDashboardResult = (segment, req, ttlMs, factory) =>
  remember(
    buildCacheKey("dashboard", segment, req.query || {}),
    ttlMs,
    factory,
  );

// Shared by the Daily Closing preview and the actual closing snapshot, so the
// two always agree on what a given date's totals are. Includes a cash/card
// breakdown (an "other" bucket catches unspecified/null payment methods) to
// help the manager reconcile the physical cash register.
const buildDailyTotals = async (date) => {
  const from = toStartOfDay(date);
  const to = toEndExclusiveDay(date);
  const range = { from, to };

  const [
    paidAggregation,
    totalOrders,
    expensesAggregation,
    paymentGroups,
    orderLineItems,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: {
        status: "paid",
        ...buildRangeFilter("updatedAt", range),
      },
      _sum: { total: true },
      _count: { id: true },
    }),
    prisma.order.count({
      where: buildRangeFilter("createdAt", range),
    }),
    prisma.expense.aggregate({
      where: buildRangeFilter("date", range),
      _sum: { amount: true },
    }),
    prisma.order.groupBy({
      where: {
        status: "paid",
        ...buildRangeFilter("updatedAt", range),
      },
      by: ["paymentMethod"],
      _sum: { total: true },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          status: "paid",
          ...buildRangeFilter("updatedAt", range),
        },
      },
      select: {
        productId: true,
        quantity: true,
        price: true,
      },
    }),
  ]);

  const totalRevenue = Number((paidAggregation._sum.total || 0).toFixed(2));
  const totalExpenses = Number(
    (expensesAggregation._sum.amount || 0).toFixed(2),
  );
  const paidOrders = paidAggregation._count.id || 0;

  let cashTotal = 0;
  let cardTotal = 0;
  let otherTotal = 0;

  paymentGroups.forEach((group) => {
    const amount = Number((group._sum.total || 0).toFixed(2));

    if (group.paymentMethod === "cash") {
      cashTotal = amount;
    } else if (group.paymentMethod === "card") {
      cardTotal = amount;
    } else {
      otherTotal = Number((otherTotal + amount).toFixed(2));
    }
  });

  // Per-product quantities/revenue for the day, e.g. "how many espressos did
  // we sell today" — needed to reconcile the till against actual items sold,
  // not just the total EUR figure.
  const productSalesMap = new Map();

  orderLineItems.forEach((lineItem) => {
    const current = productSalesMap.get(lineItem.productId) || {
      productId: lineItem.productId,
      quantitySold: 0,
      revenue: 0,
    };

    current.quantitySold += lineItem.quantity;
    current.revenue = Number(
      (current.revenue + lineItem.quantity * lineItem.price).toFixed(2),
    );
    productSalesMap.set(lineItem.productId, current);
  });

  const productSalesEntries = [...productSalesMap.values()].sort(
    (left, right) =>
      right.quantitySold - left.quantitySold || right.revenue - left.revenue,
  );
  const productIds = productSalesEntries.map((entry) => entry.productId);

  const products = productIds.length
    ? await prisma.product.findMany({
        where: {
          id: {
            in: productIds,
          },
        },
        include: {
          category: true,
        },
      })
    : [];

  const productsById = new Map(
    products.map((product) => [product.id, product]),
  );

  const productBreakdown = productSalesEntries.map((entry) => {
    const product = productsById.get(entry.productId);

    return {
      productId: entry.productId,
      productName: product?.name || `Product #${entry.productId}`,
      categoryName: product?.category?.name || "Uncategorized",
      quantitySold: entry.quantitySold,
      revenue: entry.revenue,
    };
  });

  return {
    date: formatDateKey(from),
    totalRevenue,
    totalExpenses,
    netRevenue: Number((totalRevenue - totalExpenses).toFixed(2)),
    totalOrders,
    paidOrders,
    averagePaidOrder:
      paidOrders > 0 ? Number((totalRevenue / paidOrders).toFixed(2)) : 0,
    cashTotal,
    cardTotal,
    otherTotal,
    productBreakdown,
  };
};

const escapeCsv = (value) => {
  const text = String(value ?? "");

  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
};

const appendCsvSection = (rows) =>
  rows.map((row) => row.map(escapeCsv).join(",")).join("\n");

// Both bucket builders walk the bar's calendar rather than adding 24 hours at
// a time: on the two DST weekends a day is 23 or 25 hours long, and stepping
// by a fixed 24 hours drifts across the boundary, which shows up as a
// duplicated or missing day (or month) in the report.
const buildDayBuckets = (range) => {
  const buckets = {};
  let cursor = startOfBusinessDay(range.from);

  while (cursor < range.to) {
    const key = formatDateKey(cursor);
    buckets[key] = { date: key, revenue: 0, orders: 0 };
    cursor = endOfBusinessDayExclusive(cursor);
  }

  return buckets;
};

const buildMonthBuckets = (range) => {
  const buckets = {};
  let cursor = startOfBusinessDay(range.from);

  while (cursor < range.to) {
    const key = formatMonthKey(cursor);
    buckets[key] = { month: key, revenue: 0, orders: 0 };

    const [year, month] = key.split("-").map(Number);
    cursor = parseBusinessDate(
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`,
    );
  }

  return buckets;
};

const buildAdvancedReportPayload = async (range) => {
  const [
    paidOrders,
    paidAggregation,
    expensesAggregation,
    orderLineItems,
    employeeGroups,
  ] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: "paid",
        ...buildRangeFilter("updatedAt", range),
      },
      select: {
        id: true,
        userId: true,
        total: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: "asc",
      },
    }),
    prisma.order.aggregate({
      where: {
        status: "paid",
        ...buildRangeFilter("updatedAt", range),
      },
      _sum: { total: true },
      _count: { id: true },
    }),
    prisma.expense.aggregate({
      where: buildRangeFilter("date", range),
      _sum: { amount: true },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          status: "paid",
          ...buildRangeFilter("updatedAt", range),
        },
      },
      select: {
        productId: true,
        quantity: true,
        price: true,
      },
    }),
    prisma.order.groupBy({
      where: {
        status: "paid",
        ...buildRangeFilter("updatedAt", range),
      },
      by: ["userId"],
      _sum: { total: true },
      _count: { id: true },
      orderBy: {
        _sum: {
          total: "desc",
        },
      },
    }),
  ]);

  const dayBuckets = buildDayBuckets(range);
  const monthBuckets = buildMonthBuckets(range);

  paidOrders.forEach((order) => {
    const dayKey = formatDateKey(order.updatedAt);
    const monthKey = formatMonthKey(order.updatedAt);

    if (dayBuckets[dayKey]) {
      dayBuckets[dayKey].revenue = Number(
        (dayBuckets[dayKey].revenue + order.total).toFixed(2),
      );
      dayBuckets[dayKey].orders += 1;
    }

    if (monthBuckets[monthKey]) {
      monthBuckets[monthKey].revenue = Number(
        (monthBuckets[monthKey].revenue + order.total).toFixed(2),
      );
      monthBuckets[monthKey].orders += 1;
    }
  });

  const salesByProductMap = new Map();

  orderLineItems.forEach((lineItem) => {
    const current = salesByProductMap.get(lineItem.productId) || {
      productId: lineItem.productId,
      quantitySold: 0,
      revenue: 0,
    };

    current.quantitySold += lineItem.quantity;
    current.revenue = Number(
      (current.revenue + lineItem.quantity * lineItem.price).toFixed(2),
    );
    salesByProductMap.set(lineItem.productId, current);
  });

  const salesByProductEntries = [...salesByProductMap.values()].sort(
    (left, right) =>
      right.quantitySold - left.quantitySold || right.revenue - left.revenue,
  );
  const productIds = salesByProductEntries.map((entry) => entry.productId);
  const userIds = employeeGroups
    .map((entry) => entry.userId)
    .filter((value) => Number.isInteger(value));

  const [products, users] = await Promise.all([
    productIds.length
      ? prisma.product.findMany({
          where: {
            id: {
              in: productIds,
            },
          },
          include: {
            category: true,
          },
        })
      : [],
    userIds.length
      ? prisma.user.findMany({
          where: {
            id: {
              in: userIds,
            },
          },
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        })
      : [],
  ]);

  const productsById = new Map(
    products.map((product) => [product.id, product]),
  );
  const usersById = new Map(users.map((user) => [user.id, user]));
  const totalRevenue = Number((paidAggregation._sum.total || 0).toFixed(2));
  const totalExpenses = Number(
    (expensesAggregation._sum.amount || 0).toFixed(2),
  );
  const paidOrdersCount = paidAggregation._count.id || 0;

  return {
    range: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    },
    totals: {
      totalRevenue,
      totalExpenses,
      netRevenue: Number((totalRevenue - totalExpenses).toFixed(2)),
      paidOrders: paidOrdersCount,
      averageOrderValue:
        paidOrdersCount > 0
          ? Number((totalRevenue / paidOrdersCount).toFixed(2))
          : 0,
    },
    dailySales: Object.values(dayBuckets),
    monthlySales: Object.values(monthBuckets),
    salesByProduct: salesByProductEntries.map((entry) => {
      const product = productsById.get(entry.productId);

      return {
        productId: entry.productId,
        productName: product?.name || `Product #${entry.productId}`,
        categoryName: product?.category?.name || "Uncategorized",
        quantitySold: entry.quantitySold,
        revenue: entry.revenue,
      };
    }),
    salesByEmployee: employeeGroups.map((entry, index) => {
      const user = usersById.get(entry.userId);
      const totalSales = Number((entry._sum.total || 0).toFixed(2));
      const ordersHandled = entry._count.id || 0;

      return {
        rank: index + 1,
        userId: entry.userId,
        employeeName: user?.fullName || "Unknown user",
        role: user?.role || "unknown",
        totalSales,
        ordersHandled,
        averageOrderValue:
          ordersHandled > 0
            ? Number((totalSales / ordersHandled).toFixed(2))
            : 0,
      };
    }),
  };
};

exports.getDashboardStats = async (req, res) => {
  try {
    const payload = await rememberDashboardResult(
      "stats",
      req,
      20 * 1000,
      async () => {
        const range = buildDateRange(req.query, { defaultDays: 1 });
        const openOrderStatuses = [
          "pending",
          "preparing",
          "served",
          "pending_payment",
        ];

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

        const periodRevenue = Number(
          (periodRevenueAggregation._sum.total || 0).toFixed(2),
        );
        const averageOrderValue =
          periodPaidOrders > 0
            ? Number((periodRevenue / periodPaidOrders).toFixed(2))
            : 0;

        return {
          totalProducts,
          totalCategories,
          totalOrders,
          totalRevenue: Number(
            (totalRevenueAggregation._sum.total || 0).toFixed(2),
          ),
          totalPendingOrders,
          totalCompletedOrders,
          activeTables,
          periodStart: range.from.toISOString(),
          periodEnd: range.to.toISOString(),
          todayOrders: periodOrders,
          todayRevenue: periodRevenue,
          averageOrderValue,
        };
      },
    );

    return sendSuccess(
      res,
      200,
      "Dashboard statistics retrieved successfully",
      payload,
    );
  } catch (error) {
    return handleControllerError(res, error, "Get dashboard stats error");
  }
};

exports.getTopProducts = async (req, res) => {
  try {
    const topProducts = await rememberDashboardResult(
      "top-products",
      req,
      30 * 1000,
      async () => {
        const range = buildDateRange(req.query, { defaultDays: 31 });
        const groupedItems = await prisma.orderItem.groupBy({
          where: {
            order: {
              status: "paid",
              ...buildRangeFilter("updatedAt", range),
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
          return [];
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

        const productsById = new Map(
          products.map((product) => [product.id, product]),
        );

        return groupedItems
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
      },
    );

    return sendSuccess(
      res,
      200,
      "Top products retrieved successfully",
      topProducts,
    );
  } catch (error) {
    return handleControllerError(res, error, "Get top products error");
  }
};

exports.getRecentOrders = async (req, res) => {
  try {
    const recentOrders = await rememberDashboardResult(
      "recent-orders",
      req,
      10 * 1000,
      async () =>
        prisma.order.findMany({
          include: DASHBOARD_ORDER_INCLUDE,
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
    );

    return sendSuccess(
      res,
      200,
      "Recent orders retrieved successfully",
      recentOrders,
    );
  } catch (error) {
    return handleControllerError(res, error, "Get recent orders error");
  }
};

exports.getOrdersByDate = async (req, res) => {
  try {
    const payload = await rememberDashboardResult(
      "orders",
      req,
      15 * 1000,
      async () => {
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

        const paidRevenue = Number(
          (paidAggregation._sum.total || 0).toFixed(2),
        );
        const paidCount = paidAggregation._count.id || 0;
        const averagePaidOrder =
          paidCount > 0 ? Number((paidRevenue / paidCount).toFixed(2)) : 0;

        return {
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
        };
      },
    );

    return sendSuccess(res, 200, "Orders retrieved successfully", payload);
  } catch (error) {
    return handleControllerError(res, error, "Get orders by date error");
  }
};

exports.getRevenueTrend = async (req, res) => {
  try {
    const payload = await rememberDashboardResult(
      "revenue-trend",
      req,
      20 * 1000,
      async () => {
        const hasExplicitRange = Boolean(
          req.query.from ||
          req.query.to ||
          req.query.startDate ||
          req.query.endDate,
        );
        const range = hasExplicitRange
          ? buildDateRange(req.query, { defaultDays: 31 })
          : (() => {
              const days = Math.min(
                parsePositiveInteger(req.query.days, 7),
                60,
              );
              const endDate = new Date();
              return {
                from: toStartOfDaysAgo(endDate, days - 1),
                to: toEndExclusiveDay(endDate),
              };
            })();

        const paidOrders = await prisma.order.findMany({
          where: {
            status: "paid",
            ...buildRangeFilter("updatedAt", range),
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

        const buckets = buildDayBuckets(range);

        paidOrders.forEach((order) => {
          const key = formatDateKey(order.updatedAt);
          if (!buckets[key]) {
            return;
          }

          buckets[key].revenue = Number(
            (buckets[key].revenue + order.total).toFixed(2),
          );
          buckets[key].orders += 1;
        });

        return Object.values(buckets);
      },
    );

    return sendSuccess(
      res,
      200,
      "Revenue trend retrieved successfully",
      payload,
    );
  } catch (error) {
    return handleControllerError(res, error, "Get revenue trend error");
  }
};

exports.getWaiterPerformance = async (req, res) => {
  try {
    const payload = await rememberDashboardResult(
      "waiter-performance",
      req,
      20 * 1000,
      async () => {
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
              ordersHandled > 0
                ? Number((totalSales / ordersHandled).toFixed(2))
                : 0,
          };
        });

        return {
          from: range.from.toISOString(),
          to: range.to.toISOString(),
          ranking: performance,
        };
      },
    );

    return sendSuccess(
      res,
      200,
      "Waiter performance retrieved successfully",
      payload,
    );
  } catch (error) {
    return handleControllerError(res, error, "Get waiter performance error");
  }
};

exports.getInvoices = async (req, res) => {
  try {
    const payload = await rememberDashboardResult(
      "invoices",
      req,
      15 * 1000,
      async () => {
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

        return {
          from: range.from.toISOString(),
          to: range.to.toISOString(),
          count: mappedInvoices.length,
          invoices: mappedInvoices,
        };
      },
    );

    return sendSuccess(res, 200, "Invoices retrieved successfully", payload);
  } catch (error) {
    return handleControllerError(res, error, "Get invoices error");
  }
};

exports.getDailySummary = async (req, res) => {
  try {
    const payload = await rememberDashboardResult(
      "daily-summary",
      req,
      15 * 1000,
      async () => {
        const date = req.query.date
          ? parseDateInput(req.query.date, "date")
          : new Date();
        const from = toStartOfDay(date);
        const to = toEndExclusiveDay(date);

        const [paidAggregation, totalOrders, expensesAggregation] =
          await Promise.all([
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

        const totalRevenue = Number(
          (paidAggregation._sum.total || 0).toFixed(2),
        );
        const totalExpenses = Number(
          (expensesAggregation._sum.amount || 0).toFixed(2),
        );
        const paidOrders = paidAggregation._count.id || 0;

        return {
          date: formatDateKey(from),
          totalRevenue,
          totalExpenses,
          netRevenue: Number((totalRevenue - totalExpenses).toFixed(2)),
          totalOrders,
          paidOrders,
          averagePaidOrder:
            paidOrders > 0 ? Number((totalRevenue / paidOrders).toFixed(2)) : 0,
        };
      },
    );

    return sendSuccess(
      res,
      200,
      "Daily summary retrieved successfully",
      payload,
    );
  } catch (error) {
    return handleControllerError(res, error, "Get daily summary error");
  }
};

exports.getLowStockProducts = async (req, res) => {
  try {
    const payload = await rememberDashboardResult(
      "stock-alerts",
      req,
      15 * 1000,
      async () => {
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

        const inventoryAlerts = await prisma.systemAlert.findMany({
          where: {
            type: {
              in: ["inventory.low", "product.low"],
            },
            status: "open",
          },
          orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        });

        return {
          threshold,
          count: products.length,
          products,
          inventoryAlerts,
        };
      },
    );

    return sendSuccess(
      res,
      200,
      "Low stock products retrieved successfully",
      payload,
    );
  } catch (error) {
    return handleControllerError(res, error, "Get low stock products error");
  }
};

exports.getAdvancedReport = async (req, res) => {
  try {
    const payload = await rememberDashboardResult(
      "advanced-report",
      req,
      20 * 1000,
      async () => {
        const range = buildDateRange(req.query, { defaultDays: 31 });
        return buildAdvancedReportPayload(range);
      },
    );

    return sendSuccess(
      res,
      200,
      "Advanced report retrieved successfully",
      payload,
    );
  } catch (error) {
    return handleControllerError(res, error, "Get advanced report error");
  }
};

exports.exportAdvancedReportCsv = async (req, res) => {
  try {
    const range = buildDateRange(req.query, { defaultDays: 31 });
    const report = await buildAdvancedReportPayload(range);
    const lines = [
      appendCsvSection([
        ["Metric", "Value"],
        ["From", report.range.from],
        ["To", report.range.to],
        ["Total Revenue", report.totals.totalRevenue],
        ["Total Expenses", report.totals.totalExpenses],
        ["Net Revenue", report.totals.netRevenue],
        ["Paid Orders", report.totals.paidOrders],
        ["Average Order Value", report.totals.averageOrderValue],
      ]),
      "",
      appendCsvSection([
        ["Daily Sales Date", "Revenue", "Orders"],
        ...report.dailySales.map((entry) => [
          entry.date,
          entry.revenue,
          entry.orders,
        ]),
      ]),
      "",
      appendCsvSection([
        ["Monthly Sales Month", "Revenue", "Orders"],
        ...report.monthlySales.map((entry) => [
          entry.month,
          entry.revenue,
          entry.orders,
        ]),
      ]),
      "",
      appendCsvSection([
        ["Product", "Category", "Quantity Sold", "Revenue"],
        ...report.salesByProduct.map((entry) => [
          entry.productName,
          entry.categoryName,
          entry.quantitySold,
          entry.revenue,
        ]),
      ]),
      "",
      appendCsvSection([
        ["Employee", "Role", "Orders", "Revenue", "Average Order"],
        ...report.salesByEmployee.map((entry) => [
          entry.employeeName,
          entry.role,
          entry.ordersHandled,
          entry.totalSales,
          entry.averageOrderValue,
        ]),
      ]),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="advanced-sales-report-${report.range.from.slice(
        0,
        10,
      )}-to-${report.range.to.slice(0, 10)}.csv"`,
    );

    return res.status(200).send(lines.join("\n"));
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Export advanced report CSV error",
    );
  }
};

exports.exportAdvancedReportPdf = async (req, res) => {
  try {
    const range = buildDateRange(req.query, { defaultDays: 31 });
    const report = await buildAdvancedReportPayload(range);
    const doc = new PDFDocument({
      margin: 36,
      size: "A4",
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="advanced-sales-report-${report.range.from.slice(0, 10)}.pdf"`,
    );

    doc.pipe(res);
    doc.fontSize(20).text("Cafe Advanced Sales Report");
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor("#555555").text(`From: ${report.range.from}`);
    doc.text(`To: ${report.range.to}`);
    doc.moveDown(1);

    doc.fillColor("#111111").fontSize(12).text("Summary", { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(10);
    doc.text(`Total Revenue: ${report.totals.totalRevenue} EUR`);
    doc.text(`Total Expenses: ${report.totals.totalExpenses} EUR`);
    doc.text(`Net Revenue: ${report.totals.netRevenue} EUR`);
    doc.text(`Paid Orders: ${report.totals.paidOrders}`);
    doc.text(`Average Order Value: ${report.totals.averageOrderValue} EUR`);
    doc.moveDown(0.8);

    doc.fontSize(12).text("Monthly Sales", { underline: true });
    doc.moveDown(0.4);
    report.monthlySales.slice(0, 12).forEach((entry) => {
      doc
        .fontSize(10)
        .text(
          `${entry.month}: ${entry.revenue} EUR from ${entry.orders} paid orders`,
        );
    });
    doc.moveDown(0.8);

    doc.fontSize(12).text("Top Products", { underline: true });
    doc.moveDown(0.4);
    report.salesByProduct.slice(0, 10).forEach((entry, index) => {
      doc
        .fontSize(10)
        .text(
          `${index + 1}. ${entry.productName} (${entry.categoryName}) - ${entry.quantitySold} sold / ${entry.revenue} EUR`,
        );
    });
    doc.moveDown(0.8);

    doc.fontSize(12).text("Top Employees", { underline: true });
    doc.moveDown(0.4);
    report.salesByEmployee.slice(0, 10).forEach((entry, index) => {
      doc
        .fontSize(10)
        .text(
          `${index + 1}. ${entry.employeeName} - ${entry.totalSales} EUR across ${entry.ordersHandled} orders`,
        );
    });

    doc.end();
    return undefined;
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Export advanced report PDF error",
    );
  }
};

const DAILY_CLOSING_INCLUDE = {
  closedBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
};

exports.getDailyClosingPreview = async (req, res) => {
  try {
    const date = req.query.date
      ? parseDateInput(req.query.date, "date")
      : new Date();

    const [totals, existingClosing] = await Promise.all([
      buildDailyTotals(date),
      prisma.dailyClosing.findUnique({
        where: { date: toCalendarDate(date) },
      }),
    ]);

    return sendSuccess(
      res,
      200,
      "Daily closing preview retrieved successfully",
      {
        ...totals,
        alreadyClosed: Boolean(existingClosing),
        closingId: existingClosing ? existingClosing.id : null,
        closedAt: existingClosing ? existingClosing.createdAt : null,
      },
    );
  } catch (error) {
    return handleControllerError(res, error, "Get daily closing preview error");
  }
};

exports.createDailyClosing = async (req, res) => {
  try {
    const date = req.body.date
      ? parseDateInput(req.body.date, "date")
      : new Date();
    const calendarDate = toCalendarDate(date);

    const existingClosing = await prisma.dailyClosing.findUnique({
      where: { date: calendarDate },
    });

    if (existingClosing) {
      throw new AppError("This date has already been closed", 409, {
        closingId: existingClosing.id,
      });
    }

    const totals = await buildDailyTotals(date);

    const closing = await prisma.dailyClosing.create({
      data: {
        date: calendarDate,
        totalRevenue: totals.totalRevenue,
        totalExpenses: totals.totalExpenses,
        netRevenue: totals.netRevenue,
        totalOrders: totals.totalOrders,
        paidOrders: totals.paidOrders,
        averagePaidOrder: totals.averagePaidOrder,
        cashTotal: totals.cashTotal,
        cardTotal: totals.cardTotal,
        otherTotal: totals.otherTotal,
        productBreakdown: totals.productBreakdown,
        closedById: req.user.id,
      },
      include: DAILY_CLOSING_INCLUDE,
    });

    return sendSuccess(res, 201, "Daily closing created successfully", closing);
  } catch (error) {
    if (error && error.code === "P2002") {
      return sendError(res, 409, "This date has already been closed");
    }

    return handleControllerError(res, error, "Create daily closing error");
  }
};

exports.getDailyClosings = async (req, res) => {
  try {
    const limit = Math.min(parsePositiveInteger(req.query.limit, 60), 200);

    const closings = await prisma.dailyClosing.findMany({
      include: DAILY_CLOSING_INCLUDE,
      orderBy: { date: "desc" },
      take: limit,
    });

    return sendSuccess(
      res,
      200,
      "Daily closings retrieved successfully",
      closings,
    );
  } catch (error) {
    return handleControllerError(res, error, "Get daily closings error");
  }
};

exports.getDailyClosingById = async (req, res) => {
  try {
    const id = ensureId(req.params.id, "Daily closing id");

    const closing = await prisma.dailyClosing.findUnique({
      where: { id },
      include: DAILY_CLOSING_INCLUDE,
    });

    if (!closing) {
      throw new AppError("Daily closing not found", 404);
    }

    return sendSuccess(
      res,
      200,
      "Daily closing retrieved successfully",
      closing,
    );
  } catch (error) {
    return handleControllerError(res, error, "Get daily closing by id error");
  }
};

exports.downloadDailyClosingPdf = async (req, res) => {
  try {
    const id = ensureId(req.params.id, "Daily closing id");

    const closing = await prisma.dailyClosing.findUnique({
      where: { id },
      include: DAILY_CLOSING_INCLUDE,
    });

    if (!closing) {
      throw new AppError("Daily closing not found", 404);
    }

    const dateKey = closing.date.toISOString().slice(0, 10);
    const doc = new PDFDocument({ margin: 28, size: "A5" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="mbyllja-ditore-${dateKey}.pdf"`,
    );

    doc.pipe(res);
    doc.fontSize(18).text("Mbyllja Ditore", { align: "center" });
    doc.moveDown(0.3);
    doc
      .fontSize(11)
      .fillColor("#555555")
      .text(`Data: ${dateKey}`, { align: "center" });
    doc.moveDown(1);

    doc
      .fillColor("#111111")
      .fontSize(12)
      .text("Permbledhje", { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(10);
    doc.text(`Te ardhura totale: ${closing.totalRevenue} EUR`);
    doc.text(`Shpenzimet totale: ${closing.totalExpenses} EUR`);
    doc.text(`Neto: ${closing.netRevenue} EUR`);
    doc.text(`Porosi gjithsej: ${closing.totalOrders}`);
    doc.text(`Porosi te paguara: ${closing.paidOrders}`);
    doc.text(`Mesatarja per porosi: ${closing.averagePaidOrder} EUR`);
    doc.moveDown(0.8);

    doc.fontSize(12).text("Ndarja Sipas Pageses", { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(10);
    doc.text(`Cash: ${closing.cashTotal} EUR`);
    doc.text(`Karte: ${closing.cardTotal} EUR`);
    doc.text(`Tjeter / pa specifikuar: ${closing.otherTotal} EUR`);
    doc.moveDown(0.8);

    const productBreakdown = Array.isArray(closing.productBreakdown)
      ? closing.productBreakdown
      : [];

    doc.fontSize(12).text("Shitjet Sipas Produktit", { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(10);

    if (productBreakdown.length === 0) {
      doc.fillColor("#555555").text("Nuk ka produkte te shitura kete dite.");
      doc.fillColor("#111111");
    } else {
      productBreakdown.forEach((entry, index) => {
        doc.text(
          `${index + 1}. ${entry.productName} (${entry.categoryName}) - ${entry.quantitySold} cope / ${entry.revenue} EUR`,
        );
      });
    }
    doc.moveDown(0.8);

    doc
      .fontSize(9)
      .fillColor("#555555")
      .text(
        `Mbyllur nga: ${closing.closedBy ? closing.closedBy.fullName : "—"}`,
      );
    doc.text(`Data e mbylljes: ${closing.createdAt.toISOString()}`);

    doc.end();
    return undefined;
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Download daily closing PDF error",
    );
  }
};
