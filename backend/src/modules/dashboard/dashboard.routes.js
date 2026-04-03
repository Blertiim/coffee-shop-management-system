const express = require("express");
const router = express.Router();

const dashboardController = require("./dashboard.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const { adminOrManager } = require("../../middlewares/role.middleware");

router.use(authMiddleware);
router.use(adminOrManager);

router.get("/stats", dashboardController.getDashboardStats);
router.get("/top-products", dashboardController.getTopProducts);
router.get("/recent-orders", dashboardController.getRecentOrders);
router.get("/orders", dashboardController.getOrdersByDate);
router.get("/invoices", dashboardController.getInvoices);
router.get("/waiter-performance", dashboardController.getWaiterPerformance);
router.get("/revenue-trend", dashboardController.getRevenueTrend);
router.get("/daily-summary", dashboardController.getDailySummary);
router.get("/stock-alerts", dashboardController.getLowStockProducts);

module.exports = router;
