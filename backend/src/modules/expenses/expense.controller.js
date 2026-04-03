const prisma = require("../../config/prisma");
const {
  handleControllerError,
  sendError,
  sendSuccess,
} = require("../../utils/response");
const {
  validateCreateExpensePayload,
  validateExpenseId,
  validateUpdateExpensePayload,
} = require("./expense.validation");

exports.getAllExpenses = async (req, res) => {
  try {
    const expenses = await prisma.expense.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    return sendSuccess(res, 200, "Expenses retrieved successfully", expenses);
  } catch (error) {
    return handleControllerError(res, error, "Get all expenses error");
  }
};

exports.getExpenseById = async (req, res) => {
  try {
    const id = validateExpenseId(req.params.id);

    const expense = await prisma.expense.findUnique({
      where: { id },
    });

    if (!expense) {
      return sendError(res, 404, "Expense not found");
    }

    return sendSuccess(res, 200, "Expense retrieved successfully", expense);
  } catch (error) {
    return handleControllerError(res, error, "Get expense by id error");
  }
};

exports.createExpense = async (req, res) => {
  try {
    const data = validateCreateExpensePayload(req.body);

    const expense = await prisma.expense.create({
      data,
    });

    return sendSuccess(res, 201, "Expense created successfully", expense);
  } catch (error) {
    return handleControllerError(res, error, "Create expense error");
  }
};

exports.updateExpense = async (req, res) => {
  try {
    const id = validateExpenseId(req.params.id);
    const data = validateUpdateExpensePayload(req.body);

    const existingExpense = await prisma.expense.findUnique({
      where: { id },
    });

    if (!existingExpense) {
      return sendError(res, 404, "Expense not found");
    }

    const expense = await prisma.expense.update({
      where: { id },
      data,
    });

    return sendSuccess(res, 200, "Expense updated successfully", expense);
  } catch (error) {
    return handleControllerError(res, error, "Update expense error");
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const id = validateExpenseId(req.params.id);

    const existingExpense = await prisma.expense.findUnique({
      where: { id },
    });

    if (!existingExpense) {
      return sendError(res, 404, "Expense not found");
    }

    await prisma.expense.delete({
      where: { id },
    });

    return sendSuccess(res, 200, "Expense deleted successfully", null);
  } catch (error) {
    return handleControllerError(res, error, "Delete expense error");
  }
};
