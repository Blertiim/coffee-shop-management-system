const AppError = require("../../utils/app-error");
const {
  ensureDateTime,
  ensureEnumValue,
  ensureId,
  ensureOptionalString,
  ensurePositiveNumber,
  ensureRequiredString,
} = require("../../utils/validation");

const VALID_EXPENSE_PAYMENT_METHODS = ["cash", "card", "bank", "other"];

const validateCreateExpensePayload = (body) => ({
  category: ensureRequiredString(body.category, "Expense category"),
  description: ensureOptionalString(body.description, "Expense description"),
  amount: ensurePositiveNumber(body.amount, "Expense amount"),
  date: body.date === undefined ? new Date() : ensureDateTime(body.date, "Expense date"),
  paymentMethod: ensureEnumValue(
    body.paymentMethod,
    "Expense payment method",
    VALID_EXPENSE_PAYMENT_METHODS
  ),
});

const validateUpdateExpensePayload = (body) => {
  const data = {};

  if (body.category !== undefined) {
    data.category = ensureRequiredString(body.category, "Expense category");
  }

  if (body.description !== undefined) {
    data.description = ensureOptionalString(body.description, "Expense description");
  }

  if (body.amount !== undefined) {
    data.amount = ensurePositiveNumber(body.amount, "Expense amount");
  }

  if (body.date !== undefined) {
    data.date = ensureDateTime(body.date, "Expense date");
  }

  if (body.paymentMethod !== undefined) {
    data.paymentMethod = ensureEnumValue(
      body.paymentMethod,
      "Expense payment method",
      VALID_EXPENSE_PAYMENT_METHODS
    );
  }

  if (Object.keys(data).length === 0) {
    throw new AppError("At least one field is required to update the expense");
  }

  return data;
};

const validateExpenseId = (value) => ensureId(value, "Expense id");

module.exports = {
  VALID_EXPENSE_PAYMENT_METHODS,
  validateCreateExpensePayload,
  validateUpdateExpensePayload,
  validateExpenseId,
};
