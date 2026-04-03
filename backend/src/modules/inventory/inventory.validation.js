const AppError = require("../../utils/app-error");
const {
  ensureId,
  ensureNonNegativeNumber,
  ensurePositiveNumber,
  ensureRequiredString,
} = require("../../utils/validation");

const validateCreateInventoryPayload = (body) => ({
  itemName: ensureRequiredString(body.itemName, "Inventory item name"),
  unit: ensureRequiredString(body.unit, "Inventory unit"),
  currentQuantity: ensureNonNegativeNumber(
    body.currentQuantity,
    "Inventory current quantity"
  ),
  minimumQuantity: ensureNonNegativeNumber(
    body.minimumQuantity,
    "Inventory minimum quantity"
  ),
  unitPrice: ensurePositiveNumber(body.unitPrice, "Inventory unit price"),
  supplierId: ensureId(body.supplierId, "Supplier id"),
});

const validateUpdateInventoryPayload = (body) => {
  const data = {};

  if (body.itemName !== undefined) {
    data.itemName = ensureRequiredString(body.itemName, "Inventory item name");
  }

  if (body.unit !== undefined) {
    data.unit = ensureRequiredString(body.unit, "Inventory unit");
  }

  if (body.currentQuantity !== undefined) {
    data.currentQuantity = ensureNonNegativeNumber(
      body.currentQuantity,
      "Inventory current quantity"
    );
  }

  if (body.minimumQuantity !== undefined) {
    data.minimumQuantity = ensureNonNegativeNumber(
      body.minimumQuantity,
      "Inventory minimum quantity"
    );
  }

  if (body.unitPrice !== undefined) {
    data.unitPrice = ensurePositiveNumber(body.unitPrice, "Inventory unit price");
  }

  if (body.supplierId !== undefined) {
    data.supplierId = ensureId(body.supplierId, "Supplier id");
  }

  if (Object.keys(data).length === 0) {
    throw new AppError("At least one field is required to update the inventory item");
  }

  return data;
};

const validateInventoryId = (value) => ensureId(value, "Inventory id");

module.exports = {
  validateCreateInventoryPayload,
  validateUpdateInventoryPayload,
  validateInventoryId,
};
