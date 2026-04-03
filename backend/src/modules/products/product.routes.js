const express = require("express");
const router = express.Router();

const productController = require("./product.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const { adminOnly } = require("../../middlewares/role.middleware");

router.get("/", productController.getAllProducts);
router.get("/:id", productController.getProductById);
router.post("/", authMiddleware, adminOnly, productController.createProduct);
router.put("/:id", authMiddleware, adminOnly, productController.updateProduct);
router.delete(
  "/:id",
  authMiddleware,
  adminOnly,
  productController.deleteProduct
);

module.exports = router;
