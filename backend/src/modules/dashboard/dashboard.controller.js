const prisma = require("../../config/prisma");

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
        where: { status: "completed" },
      }),
      prisma.order.aggregate({
        where: { status: "completed" },
        _sum: { total: true },
      }),
    ]);

    res.status(200).json({
      stats: {
        totalProducts,
        totalCategories,
        totalOrders,
        totalRevenue: Number((revenueAggregation._sum.total || 0).toFixed(2)),
        totalPendingOrders,
        totalCompletedOrders,
      },
    });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getTopProducts = async (req, res) => {
  try {
    const groupedItems = await prisma.orderItem.groupBy({
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
      return res.status(200).json({ topProducts: [] });
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

    res.status(200).json({ topProducts });
  } catch (error) {
    console.error("Get top products error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getRecentOrders = async (req, res) => {
  try {
    const recentOrders = await prisma.order.findMany({
      include: recentOrderInclude,
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    res.status(200).json({ recentOrders });
  } catch (error) {
    console.error("Get recent orders error:", error);
    res.status(500).json({ error: "Server error" });
  }
};
