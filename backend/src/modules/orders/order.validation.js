const AppError = require("../../utils/app-error");
const {
  ensureArray,
  ensureEnumValue,
  ensureId,
  ensureNonNegativeNumber,
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
const VALID_DISCOUNT_TYPES = ["percent", "fixed"];

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
  const hasPaymentMethod =
    body.paymentMethod !== undefined &&
    body.paymentMethod !== null &&
    String(body.paymentMethod).trim() !== "";
  const hasDiscountType =
    body.discountType !== undefined &&
    body.discountType !== null &&
    String(body.discountType).trim() !== "";

  const discountType = hasDiscountType
    ? ensureEnumValue(body.discountType, "Discount type", VALID_DISCOUNT_TYPES)
    : null;
  const discountValue =
    discountType !== null ? ensureNonNegativeNumber(body.discountValue, "Discount value") : null;

  if (discountType === "percent" && discountValue > 100) {
    throw new AppError("Discount value cannot be greater than 100%");
  }

  return {
    items: normalizeOrderItems(body.items),
    tableId: ensureId(body.tableId, "Table id"),
    employeeId: hasEmployeeId ? ensureId(body.employeeId, "Employee id") : null,
    paymentMethod: hasPaymentMethod
      ? ensureEnumValue(body.paymentMethod, "Payment method", VALID_PAYMENT_METHODS)
      : null,
    discountType,
    discountValue,
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

const validateCompletePaymentPayload = (body = {}) => ({
  paymentMethod:
    body.paymentMethod !== undefined && body.paymentMethod !== null
      ? ensureEnumValue(body.paymentMethod, "Payment method", VALID_PAYMENT_METHODS)
      : null,
});

const validateTransferOrderPayload = (body = {}) => ({
  tableId: ensureId(body.tableId, "Target table id"),
});

const validateOrderDiscountPayload = (body = {}) => {
  const hasDiscountType =
    body.discountType !== undefined &&
    body.discountType !== null &&
    String(body.discountType).trim() !== "";

  if (!hasDiscountType) {
    return {
      discountType: null,
      discountValue: null,
    };
  }

  const discountType = ensureEnumValue(body.discountType, "Discount type", VALID_DISCOUNT_TYPES);
  const discountValue = ensureNonNegativeNumber(body.discountValue, "Discount value");

  if (discountType === "percent" && discountValue > 100) {
    throw new AppError("Discount value cannot be greater than 100%");
  }

  return {
    discountType,
    discountValue,
  };
};

module.exports = {
  VALID_DISCOUNT_TYPES,
  VALID_ORDER_STATUSES,
  VALID_PAYMENT_METHODS,
  validateCreateOrderPayload,
  validateOrderId,
  validateTableId,
  validateOrderStatusUpdatePayload,
  validateAppendOrderItemsPayload,
  validateCompletePaymentPayload,
  validateTransferOrderPayload,
  validateOrderDiscountPayload,
};
