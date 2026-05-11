const express = require("express");

const authMiddleware = require("../../middlewares/auth.middleware");
const { adminOrManager } = require("../../middlewares/role.middleware");
const supplierOrderController = require("./supplier-order.controller");

const router = express.Router();

router.use(authMiddleware);
router.use(adminOrManager);

router.get("/", supplierOrderController.getAllSupplierOrders);
router.get("/:id/pdf", supplierOrderController.downloadSupplierInvoicePdf);
router.get("/:id", supplierOrderController.getSupplierOrderById);
router.post("/", supplierOrderController.createSupplierOrder);
router.put("/:id", supplierOrderController.updateSupplierOrder);
router.delete("/:id", supplierOrderController.deleteSupplierOrder);

module.exports = router;
