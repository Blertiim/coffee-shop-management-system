const express = require("express");

const authMiddleware = require("../../middlewares/auth.middleware");
const { adminOnly } = require("../../middlewares/role.middleware");
const expenseController = require("./expense.controller");

const router = express.Router();

router.use(authMiddleware);
router.use(adminOnly);

router.get("/", expenseController.getAllExpenses);
router.get("/:id", expenseController.getExpenseById);
router.post("/", expenseController.createExpense);
router.put("/:id", expenseController.updateExpense);
router.delete("/:id", expenseController.deleteExpense);

module.exports = router;
