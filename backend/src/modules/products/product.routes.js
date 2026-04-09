const express = require("express");
const router = express.Router();

const productController = require("./product.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const { adminOrManager } = require("../../middlewares/role.middleware");

router.use(authMiddleware);

router.get("/", productController.getAllProducts);
router.get("/:id", productController.getProductById);
router.post("/", adminOrManager, productController.createProduct);
router.put("/:id", adminOrManager, productController.updateProduct);
router.patch(
  "/:id/stock",
  adminOrManager,
  productController.updateProductStock
);
router.delete(
  "/:id",
  adminOrManager,
  productController.deleteProduct
);

module.exports = router;
