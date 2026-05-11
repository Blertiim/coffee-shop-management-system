const AppError = require("../../utils/app-error");
const {
  ensureDateTime,
  ensureEnumValue,
  ensureId,
  ensureNonNegativeNumber,
  ensureOptionalString,
  ensurePositiveInteger,
  ensurePositiveNumber,
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

const normalizeSupplierOrderItems = (items, { required = false } = {}) => {
  if (items === undefined) {
    if (required) {
      throw new AppError("Supplier order items are required");
    }

    return undefined;
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("Supplier order items are required");
  }

  const productIds = new Set();

  return items.map((item, index) => {
    const productId = ensureId(item?.productId, `Supplier order item ${index + 1} product id`);

    if (productIds.has(productId)) {
      throw new AppError("Each product can only appear once per supplier order");
    }

    productIds.add(productId);

    return {
      productId,
      quantity: ensurePositiveInteger(
        item?.quantity,
        `Supplier order item ${index + 1} quantity`
      ),
      unitPrice: ensurePositiveNumber(
        item?.unitPrice,
        `Supplier order item ${index + 1} unit price`
      ),
      unit: ensureOptionalString(item?.unit, `Supplier order item ${index + 1} unit`),
    };
  });
};

const calculateItemsTotal = (items) =>
  Number(
    items
      .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
      .toFixed(2)
  );

const validateCreateSupplierOrderPayload = (body) => {
  const items = normalizeSupplierOrderItems(body.items, { required: true });
  const explicitTotal =
    body.total === undefined
      ? undefined
      : ensureNonNegativeNumber(body.total, "Supplier order total");

  return {
    supplierId: ensureId(body.supplierId, "Supplier id"),
    employeeId: normalizeOptionalId(body.employeeId, "Employee id"),
    invoiceNumber: ensureOptionalString(
      body.invoiceNumber,
      "Supplier order invoice number"
    ),
    orderDate:
      body.orderDate === undefined
        ? new Date()
        : ensureDateTime(body.orderDate, "Supplier order date"),
    expectedDate: normalizeOptionalDateTime(
      body.expectedDate,
      "Supplier order expected date"
    ),
    total: explicitTotal === undefined ? calculateItemsTotal(items) : explicitTotal,
    status:
      body.status === undefined
        ? "pending"
        : ensureEnumValue(
            body.status,
            "Supplier order status",
            VALID_SUPPLIER_ORDER_STATUSES
          ),
    notes: ensureOptionalString(body.notes, "Supplier order notes"),
    items,
  };
};

const validateUpdateSupplierOrderPayload = (body) => {
  const data = {};

  if (body.supplierId !== undefined) {
    data.supplierId = ensureId(body.supplierId, "Supplier id");
  }

  if (body.employeeId !== undefined) {
    data.employeeId = normalizeOptionalId(body.employeeId, "Employee id");
  }

  if (body.invoiceNumber !== undefined) {
    data.invoiceNumber = ensureOptionalString(
      body.invoiceNumber,
      "Supplier order invoice number"
    );
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

  if (body.items !== undefined) {
    data.items = normalizeSupplierOrderItems(body.items);

    if (body.total === undefined) {
      data.total = calculateItemsTotal(data.items);
    }
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
