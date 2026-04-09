const express = require("express");
const router = express.Router();

const categoryController = require("./category.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const { adminOrManager } = require("../../middlewares/role.middleware");

router.use(authMiddleware);

router.get("/", categoryController.getAllCategories);
router.get("/:id", categoryController.getCategoryById);
router.post("/", adminOrManager, categoryController.createCategory);
router.put("/:id", adminOrManager, categoryController.updateCategory);
router.delete(
  "/:id",
  adminOrManager,
  categoryController.deleteCategory
);

module.exports = router;
