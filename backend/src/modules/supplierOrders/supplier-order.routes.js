const express = require("express");

const authMiddleware = require("../../middlewares/auth.middleware");
const { adminOnly } = require("../../middlewares/role.middleware");
const supplierOrderController = require("./supplier-order.controller");

const router = express.Router();

router.use(authMiddleware);
router.use(adminOnly);

router.get("/", supplierOrderController.getAllSupplierOrders);
router.get("/:id", supplierOrderController.getSupplierOrderById);
router.post("/", supplierOrderController.createSupplierOrder);
router.put("/:id", supplierOrderController.updateSupplierOrder);
router.delete("/:id", supplierOrderController.deleteSupplierOrder);

module.exports = router;
