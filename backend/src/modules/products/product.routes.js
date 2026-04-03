const express = require("express");
const router = express.Router();

const productController = require("./product.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const { adminOrManager } = require("../../middlewares/role.middleware");

router.get("/", productController.getAllProducts);
router.get("/:id", productController.getProductById);
router.post("/", authMiddleware, adminOrManager, productController.createProduct);
router.put("/:id", authMiddleware, adminOrManager, productController.updateProduct);
router.patch(
  "/:id/stock",
  authMiddleware,
  adminOrManager,
  productController.updateProductStock
);
router.delete(
  "/:id",
  authMiddleware,
  adminOrManager,
  productController.deleteProduct
);

module.exports = router;
