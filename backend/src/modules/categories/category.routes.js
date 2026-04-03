const express = require("express");
const router = express.Router();

const categoryController = require("./category.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const { adminOnly } = require("../../middlewares/role.middleware");

router.get("/", categoryController.getAllCategories);
router.get("/:id", categoryController.getCategoryById);
router.post("/", authMiddleware, adminOnly, categoryController.createCategory);
router.put("/:id", authMiddleware, adminOnly, categoryController.updateCategory);
router.delete(
  "/:id",
  authMiddleware,
  adminOnly,
  categoryController.deleteCategory
);

module.exports = router;
