const express = require("express");
const router = express.Router();

const orderController = require("./order.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const { requireAdmin } = require("../../middlewares/auth.middleware");

router.post("/orders", authMiddleware, orderController.createOrder);
router.get("/orders", authMiddleware, requireAdmin, orderController.getAllOrders);
router.get("/my-orders", authMiddleware, orderController.getMyOrders);
router.get("/orders/:id", authMiddleware, orderController.getOrderById);
router.patch(
  "/orders/:id/status",
  authMiddleware,
  requireAdmin,
  orderController.updateOrderStatus
);

module.exports = router;
