const prisma = require("../../config/prisma");
const AppError = require("../../utils/app-error");
const { createInventoryLedgerRepository } = require("./inventory-ledger.repository");
const { buildPagination } = require("./ingredient.service");
const { resolveBaseQuantity } = require("./inventory-engine.service");

const upsertRecipe = async (payload) =>
  prisma.$transaction(async (tx) => {
    const repository = createInventoryLedgerRepository(tx);
    const product = await repository.findProductById(payload.productId);

    if (!product || product.deletedAt) {
      throw new AppError("Product not found", 404);
    }

    const ingredientIds = payload.items.map((item) => item.ingredientId);
    const ingredients = await repository.findIngredientsByIds(ingredientIds);
    const ingredientsById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));

    if (ingredients.length !== new Set(ingredientIds).size) {
      throw new AppError("One or more recipe ingredients were not found", 404);
    }

    const items = payload.items.map((item) => {
      const ingredient = ingredientsById.get(item.ingredientId);

      return {
        ingredientId: item.ingredientId,
        quantity: resolveBaseQuantity({
          quantity: item.quantity,
          unit: item.unit,
          baseUnit: ingredient.baseUnit,
        }),
        unit: ingredient.baseUnit,
      };
    });

    return repository.upsertRecipe({
      productId: payload.productId,
      notes: payload.notes,
      items,
    });
  });

const listRecipes = async (pagination) => {
  const repository = createInventoryLedgerRepository(prisma);
  const [items, total] = await Promise.all([
    repository.listRecipes(pagination),
    repository.countRecipes(),
  ]);

  return {
    items,
    pagination: buildPagination({ ...pagination, total }),
  };
};

module.exports = {
  listRecipes,
  upsertRecipe,
};
