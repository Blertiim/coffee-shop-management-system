const AppError = require("../../utils/app-error");
const { assertBaseUnit, convertToBaseQuantity, normalizeUnit } = require("./unit-conversion");

const MOVEMENT_TYPES = new Set(["IN", "OUT", "ADJUSTMENT", "TRANSFER"]);

const toNumber = (value) => Number(value || 0);

const roundQuantity = (value) => Number(Number(value || 0).toFixed(3));

const assertPositiveQuantity = (quantity) => {
  const normalized = roundQuantity(quantity);

  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new AppError("Stock movement quantity must be greater than 0");
  }

  return normalized;
};

const resolveBaseQuantity = ({ quantity, unit, baseUnit }) =>
  assertPositiveQuantity(convertToBaseQuantity(quantity, unit, baseUnit));

const applyIngredientMovement = async ({
  tx,
  ingredientId,
  type,
  quantity,
  unit,
  sourceType,
  sourceId = null,
  stockIntakeId = null,
  unitCost = null,
  totalCost = null,
  reason = null,
  actorId = null,
}) => {
  if (!tx) {
    throw new AppError("Inventory movement requires a database transaction");
  }

  if (!MOVEMENT_TYPES.has(type)) {
    throw new AppError("Invalid stock movement type");
  }

  const ingredient = await tx.ingredient.findFirst({
    where: {
      id: ingredientId,
      isActive: true,
    },
  });

  if (!ingredient) {
    throw new AppError("Ingredient not found", 404);
  }

  const baseUnit = assertBaseUnit(ingredient.baseUnit, "Ingredient base unit");
  const movementUnit = assertBaseUnit(unit || baseUnit, "Stock movement unit");
  const movementQuantity = assertPositiveQuantity(quantity);

  if (movementUnit !== baseUnit) {
    throw new AppError(`Stock movement for ${ingredient.name} must use ${baseUnit}`);
  }

  const previousStock = roundQuantity(ingredient.currentQuantity);
  const signedQuantity = type === "OUT" ? -movementQuantity : movementQuantity;
  const newStock = roundQuantity(previousStock + signedQuantity);

  if (newStock < 0) {
    throw new AppError(`Not enough ${ingredient.name}`);
  }

  await tx.ingredient.update({
    where: { id: ingredient.id },
    data: {
      currentQuantity: newStock,
      ...(unitCost !== null && unitCost !== undefined
        ? { averageCost: Number(unitCost) }
        : {}),
      baseUnit,
    },
  });

  return tx.stockMovement.create({
    data: {
      ingredientId: ingredient.id,
      stockIntakeId,
      type,
      sourceType,
      sourceId: sourceId === null || sourceId === undefined ? null : String(sourceId),
      quantity: movementQuantity,
      unit: baseUnit,
      previousStock,
      newStock,
      unitCost,
      totalCost,
      reason,
      createdById: actorId || null,
    },
  });
};

const consumeIngredientsForOrderItems = async ({ tx, orderItems, actorId, sourceId }) => {
  const productIds = orderItems.map((item) => item.productId);
  const recipes = await tx.recipe.findMany({
    where: {
      productId: { in: productIds },
      isActive: true,
    },
    include: {
      items: {
        include: { ingredient: true },
      },
      product: true,
    },
  });
  const recipesByProductId = new Map(recipes.map((recipe) => [recipe.productId, recipe]));
  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true },
  });
  const productsById = new Map(products.map((product) => [product.id, product]));

  for (const orderItem of orderItems) {
    const recipe = recipesByProductId.get(orderItem.productId);

    if (!recipe || !recipe.items.length) {
      const product = productsById.get(orderItem.productId);
      throw new AppError(
        `Product "${product?.name || orderItem.productId}" needs a recipe before it can be sold`
      );
    }

    for (const recipeItem of recipe.items) {
      const baseUnit = assertBaseUnit(recipeItem.ingredient.baseUnit, "Ingredient base unit");
      const quantity = roundQuantity(toNumber(recipeItem.quantity) * orderItem.quantity);

      await applyIngredientMovement({
        tx,
        ingredientId: recipeItem.ingredientId,
        type: "OUT",
        quantity,
        unit: baseUnit,
        sourceType: "SALE",
        sourceId,
        reason: `${recipe.product.name} x${orderItem.quantity}`,
        actorId,
      });
    }
  }
};

const restoreIngredientsForOrderItems = async ({ tx, orderItems, actorId, sourceId }) => {
  const productIds = orderItems.map((item) => item.productId);
  const recipes = await tx.recipe.findMany({
    where: {
      productId: { in: productIds },
      isActive: true,
    },
    include: {
      items: {
        include: { ingredient: true },
      },
      product: true,
    },
  });
  const recipesByProductId = new Map(recipes.map((recipe) => [recipe.productId, recipe]));

  for (const orderItem of orderItems) {
    const recipe = recipesByProductId.get(orderItem.productId);

    if (!recipe || !recipe.items.length) {
      continue;
    }

    for (const recipeItem of recipe.items) {
      const baseUnit = assertBaseUnit(recipeItem.ingredient.baseUnit, "Ingredient base unit");
      const quantity = roundQuantity(toNumber(recipeItem.quantity) * orderItem.quantity);

      await applyIngredientMovement({
        tx,
        ingredientId: recipeItem.ingredientId,
        type: "IN",
        quantity,
        unit: baseUnit,
        sourceType: "SALE_CANCEL_RESTORE",
        sourceId,
        reason: `Restored ${recipe.product.name} x${orderItem.quantity}`,
        actorId,
      });
    }
  }
};

module.exports = {
  applyIngredientMovement,
  consumeIngredientsForOrderItems,
  normalizeUnit,
  resolveBaseQuantity,
  restoreIngredientsForOrderItems,
};
