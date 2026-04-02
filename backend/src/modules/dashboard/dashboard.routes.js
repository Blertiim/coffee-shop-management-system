const express = require("express");
const router = express.Router();

const dashboardController = require("./dashboard.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const { requireAdmin } = require("../../middlewares/auth.middleware");

router.use(authMiddleware);
router.use(requireAdmin);

router.get("/stats", dashboardController.getDashboardStats);
router.get("/top-products", dashboardController.getTopProducts);
router.get("/recent-orders", dashboardController.getRecentOrders);

module.exports = router;
