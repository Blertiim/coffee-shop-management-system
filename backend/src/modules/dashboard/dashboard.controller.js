const prisma = require("../../config/prisma");
const { handleControllerError, sendSuccess } = require("../../utils/response");

const recentOrderInclude = {
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

exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalProducts,
      totalCategories,
      totalOrders,
      totalPendingOrders,
      totalCompletedOrders,
      revenueAggregation,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.category.count(),
      prisma.order.count(),
      prisma.order.count({
        where: { status: "pending" },
      }),
      prisma.order.count({
        where: { status: "paid" },
      }),
      prisma.order.aggregate({
        where: { status: "paid" },
        _sum: { total: true },
      }),
    ]);

    return sendSuccess(res, 200, "Dashboard statistics retrieved successfully", {
        totalProducts,
        totalCategories,
        totalOrders,
        totalRevenue: Number((revenueAggregation._sum.total || 0).toFixed(2)),
        totalPendingOrders,
        totalCompletedOrders,
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
      include: recentOrderInclude,
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return sendSuccess(res, 200, "Recent orders retrieved successfully", recentOrders);
  } catch (error) {
    return handleControllerError(res, error, "Get recent orders error");
  }
};
