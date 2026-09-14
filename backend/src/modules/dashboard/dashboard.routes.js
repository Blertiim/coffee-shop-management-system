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
router.get("/advanced-report", dashboardController.getAdvancedReport);
router.get("/export/report.csv", dashboardController.exportAdvancedReportCsv);
router.get("/export/report.pdf", dashboardController.exportAdvancedReportPdf);

router.get(
  "/daily-closing/preview",
  dashboardController.getDailyClosingPreview,
);
router.get("/daily-closing", dashboardController.getDailyClosings);
router.post("/daily-closing", dashboardController.createDailyClosing);
router.get(
  "/daily-closing/:id/pdf",
  dashboardController.downloadDailyClosingPdf,
);
router.get("/daily-closing/:id", dashboardController.getDailyClosingById);

module.exports = router;
