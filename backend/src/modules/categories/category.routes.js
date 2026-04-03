const express = require("express");
const router = express.Router();

const categoryController = require("./category.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const { adminOrManager } = require("../../middlewares/role.middleware");

router.get("/", categoryController.getAllCategories);
router.get("/:id", categoryController.getCategoryById);
router.post("/", authMiddleware, adminOrManager, categoryController.createCategory);
router.put("/:id", authMiddleware, adminOrManager, categoryController.updateCategory);
router.delete(
  "/:id",
  authMiddleware,
  adminOrManager,
  categoryController.deleteCategory
);

module.exports = router;
