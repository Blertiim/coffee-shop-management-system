const express = require("express");
const router = express.Router();

const productController = require("./product.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const { requireAdmin } = require("../../middlewares/auth.middleware");

router.get("/", productController.getAllProducts);
router.get("/:id", productController.getProductById);
router.post("/", authMiddleware, requireAdmin, productController.createProduct);
router.put("/:id", authMiddleware, requireAdmin, productController.updateProduct);
router.delete(
  "/:id",
  authMiddleware,
  requireAdmin,
  productController.deleteProduct
);

module.exports = router;
