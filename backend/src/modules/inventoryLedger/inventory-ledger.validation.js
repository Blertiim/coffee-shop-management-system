const {
  ensureArray,
  ensureId,
  ensureNonNegativeNumber,
  ensureOptionalString,
  ensurePositiveNumber,
  ensureRequiredString,
} = require("../../utils/validation");
const { assertBaseUnit, assertKnownUnit, normalizeUnit } = require("./unit-conversion");

const parsePageParams = (query = {}) => {
  const page = Math.max(1, Number.parseInt(query.page || "1", 10) || 1);
  const pageSize = Math.min(
    Math.max(1, Number.parseInt(query.pageSize || "25", 10) || 25),
    100
  );

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
};

const validateCreateIngredientPayload = (body = {}) => ({
  name: ensureRequiredString(body.name, "Ingredient name"),
  sku: ensureOptionalString(body.sku, "Ingredient SKU"),
  baseUnit: assertBaseUnit(body.baseUnit, "Ingredient base unit"),
  minimumQuantity:
    body.minimumQuantity === undefined
      ? 0
      : ensureNonNegativeNumber(body.minimumQuantity, "Minimum quantity"),
});

const validateStockIntakePayload = (body = {}) => {
  const items = ensureArray(body.items, "Stock intake items").map((item, index) => ({
    ingredientId: ensureId(item?.ingredientId, `Item ${index + 1} ingredient id`),
    purchasedQuantity: ensurePositiveNumber(
      item?.purchasedQuantity,
      `Item ${index + 1} purchased quantity`
    ),
    purchasedUnit: assertKnownUnit(item?.purchasedUnit, `Item ${index + 1} purchased unit`),
    unitCost: ensurePositiveNumber(item?.unitCost, `Item ${index + 1} unit cost`),
  }));

  return {
    supplierId: ensureId(body.supplierId, "Supplier id"),
    invoiceNumber: ensureOptionalString(body.invoiceNumber, "Invoice number"),
    notes: ensureOptionalString(body.notes, "Notes"),
    confirm: body.confirm !== false,
    items,
  };
};

const validateRecipePayload = (body = {}) => {
  const items = ensureArray(body.items, "Recipe items").map((item, index) => ({
    ingredientId: ensureId(item?.ingredientId, `Recipe item ${index + 1} ingredient id`),
    quantity: ensurePositiveNumber(item?.quantity, `Recipe item ${index + 1} quantity`),
    unit: normalizeUnit(assertKnownUnit(item?.unit, `Recipe item ${index + 1} unit`)),
  }));

  return {
    productId: ensureId(body.productId, "Product id"),
    notes: ensureOptionalString(body.notes, "Recipe notes"),
    items,
  };
};

module.exports = {
  parsePageParams,
  validateCreateIngredientPayload,
  validateRecipePayload,
  validateStockIntakePayload,
};
