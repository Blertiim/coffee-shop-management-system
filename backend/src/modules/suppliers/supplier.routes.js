const express = require("express");

const authMiddleware = require("../../middlewares/auth.middleware");
const { adminOnly } = require("../../middlewares/role.middleware");
const supplierController = require("./supplier.controller");

const router = express.Router();

router.use(authMiddleware);
router.use(adminOnly);

router.get("/", supplierController.getAllSuppliers);
router.get("/:id", supplierController.getSupplierById);
router.post("/", supplierController.createSupplier);
router.put("/:id", supplierController.updateSupplier);
router.delete("/:id", supplierController.deleteSupplier);

module.exports = router;
