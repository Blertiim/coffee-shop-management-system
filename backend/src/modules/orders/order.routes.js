const express = require("express");

const authMiddleware = require("../../middlewares/auth.middleware");
const { adminOrManager } = require("../../middlewares/role.middleware");
const orderController = require("./order.controller");

const router = express.Router();

router.post("/orders", authMiddleware, orderController.createOrder);
router.get("/orders", authMiddleware, adminOrManager, orderController.getAllOrders);
router.get(
  "/orders/table/:tableId/active",
  authMiddleware,
  orderController.getActiveOrderByTable
);
router.get("/my-orders", authMiddleware, orderController.getMyOrders);
router.get(
  "/orders/totals/today-paid",
  authMiddleware,
  orderController.getTodayPaidTotals
);
router.get("/orders/:id", authMiddleware, orderController.getOrderById);
router.get("/orders/:id/receipt", authMiddleware, orderController.downloadOrderReceipt);
router.post("/orders/:id/items", authMiddleware, orderController.appendItemsToOrder);
router.patch(
  "/orders/:id/generate-invoice",
  authMiddleware,
  orderController.generateInvoice
);
router.patch(
  "/orders/:id/transfer-table",
  authMiddleware,
  orderController.transferOrderToTable
);
router.patch(
  "/orders/:id/complete-payment",
  authMiddleware,
  orderController.completePayment
);
router.patch("/orders/:id/status", authMiddleware, orderController.updateOrderStatus);

module.exports = router;
