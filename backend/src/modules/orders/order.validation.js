const AppError = require("../../utils/app-error");
const {
  ensureArray,
  ensureEnumValue,
  ensureId,
  ensurePositiveInteger,
} = require("../../utils/validation");

const VALID_ORDER_STATUSES = [
  "pending",
  "preparing",
  "served",
  "pending_payment",
  "paid",
  "cancelled",
];

const VALID_PAYMENT_METHODS = ["cash", "card"];

const normalizeOrderItems = (items) => {
  const normalizedItems = ensureArray(items, "Order items").map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new AppError(`Order item at position ${index + 1} must be an object`);
    }

    return {
      productId: ensureId(item.productId, `Order item ${index + 1} product id`),
      quantity: ensurePositiveInteger(
        item.quantity,
        `Order item ${index + 1} quantity`
      ),
    };
  });

  const uniqueProductIds = new Set(normalizedItems.map((item) => item.productId));

  if (uniqueProductIds.size !== normalizedItems.length) {
    throw new AppError("Each product can only appear once per order");
  }

  return normalizedItems;
};

const validateCreateOrderPayload = (body) => {
  if (body.status !== undefined && String(body.status).trim().toLowerCase() !== "pending") {
    throw new AppError("New orders must start with pending status");
  }

  const hasEmployeeId =
    body.employeeId !== undefined &&
    body.employeeId !== null &&
    String(body.employeeId).trim() !== "";

  return {
    items: normalizeOrderItems(body.items),
    tableId: ensureId(body.tableId, "Table id"),
    employeeId: hasEmployeeId ? ensureId(body.employeeId, "Employee id") : null,
    paymentMethod: ensureEnumValue(
      body.paymentMethod,
      "Payment method",
      VALID_PAYMENT_METHODS
    ),
  };
};

const validateOrderId = (value) => ensureId(value, "Order id");
const validateTableId = (value) => ensureId(value, "Table id");

const validateOrderStatusUpdatePayload = (body) => ({
  status: ensureEnumValue(body.status, "Order status", VALID_ORDER_STATUSES),
});

const validateAppendOrderItemsPayload = (body) => ({
  items: normalizeOrderItems(body.items),
});

module.exports = {
  VALID_ORDER_STATUSES,
  VALID_PAYMENT_METHODS,
  validateCreateOrderPayload,
  validateOrderId,
  validateTableId,
  validateOrderStatusUpdatePayload,
  validateAppendOrderItemsPayload,
};
