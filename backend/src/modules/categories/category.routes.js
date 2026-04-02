const express = require("express");
const router = express.Router();

const categoryController = require("./category.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const { requireAdmin } = require("../../middlewares/auth.middleware");

router.get("/", categoryController.getAllCategories);
router.get("/:id", categoryController.getCategoryById);
router.post("/", authMiddleware, requireAdmin, categoryController.createCategory);
router.put("/:id", authMiddleware, requireAdmin, categoryController.updateCategory);
router.delete(
  "/:id",
  authMiddleware,
  requireAdmin,
  categoryController.deleteCategory
);

module.exports = router;
