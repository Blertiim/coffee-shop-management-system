const express = require("express");
const router = express.Router();

const dashboardController = require("./dashboard.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const { adminOnly } = require("../../middlewares/role.middleware");

router.use(authMiddleware);
router.use(adminOnly);

router.get("/stats", dashboardController.getDashboardStats);
router.get("/top-products", dashboardController.getTopProducts);
router.get("/recent-orders", dashboardController.getRecentOrders);

module.exports = router;
