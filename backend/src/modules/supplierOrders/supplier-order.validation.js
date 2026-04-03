const AppError = require("../../utils/app-error");
const {
  ensureDateTime,
  ensureEnumValue,
  ensureId,
  ensureNonNegativeNumber,
  ensureOptionalString,
} = require("../../utils/validation");

const VALID_SUPPLIER_ORDER_STATUSES = [
  "pending",
  "approved",
  "delivered",
  "cancelled",
];

const normalizeOptionalId = (value, fieldName) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  return ensureId(value, fieldName);
};

const normalizeOptionalDateTime = (value, fieldName) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  return ensureDateTime(value, fieldName);
};

const validateCreateSupplierOrderPayload = (body) => ({
  supplierId: ensureId(body.supplierId, "Supplier id"),
  employeeId: normalizeOptionalId(body.employeeId, "Employee id"),
  orderDate:
    body.orderDate === undefined
      ? new Date()
      : ensureDateTime(body.orderDate, "Supplier order date"),
  expectedDate: normalizeOptionalDateTime(
    body.expectedDate,
    "Supplier order expected date"
  ),
  total: ensureNonNegativeNumber(body.total, "Supplier order total"),
  status:
    body.status === undefined
      ? "pending"
      : ensureEnumValue(
          body.status,
          "Supplier order status",
          VALID_SUPPLIER_ORDER_STATUSES
        ),
  notes: ensureOptionalString(body.notes, "Supplier order notes"),
});

const validateUpdateSupplierOrderPayload = (body) => {
  const data = {};

  if (body.supplierId !== undefined) {
    data.supplierId = ensureId(body.supplierId, "Supplier id");
  }

  if (body.employeeId !== undefined) {
    data.employeeId = normalizeOptionalId(body.employeeId, "Employee id");
  }

  if (body.orderDate !== undefined) {
    data.orderDate = ensureDateTime(body.orderDate, "Supplier order date");
  }

  if (body.expectedDate !== undefined) {
    data.expectedDate = normalizeOptionalDateTime(
      body.expectedDate,
      "Supplier order expected date"
    );
  }

  if (body.total !== undefined) {
    data.total = ensureNonNegativeNumber(body.total, "Supplier order total");
  }

  if (body.status !== undefined) {
    data.status = ensureEnumValue(
      body.status,
      "Supplier order status",
      VALID_SUPPLIER_ORDER_STATUSES
    );
  }

  if (body.notes !== undefined) {
    data.notes = ensureOptionalString(body.notes, "Supplier order notes");
  }

  if (Object.keys(data).length === 0) {
    throw new AppError(
      "At least one field is required to update the supplier order"
    );
  }

  return data;
};

const validateSupplierOrderId = (value) => ensureId(value, "Supplier order id");

module.exports = {
  VALID_SUPPLIER_ORDER_STATUSES,
  validateCreateSupplierOrderPayload,
  validateUpdateSupplierOrderPayload,
  validateSupplierOrderId,
};
