const prisma = require("../../config/prisma");
const AppError = require("../../utils/app-error");
const {
  createInventoryLedgerRepository,
} = require("./inventory-ledger.repository");

const buildPagination = ({ page, pageSize, total }) => ({
  page,
  pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / pageSize)),
});

const createIngredient = async (data) => {
  const repository = createInventoryLedgerRepository(prisma);

  return repository.createIngredient({
    name: data.name,
    sku: data.sku,
    baseUnit: data.baseUnit,
    minimumQuantity: data.minimumQuantity,
  });
};

const listIngredients = async (pagination) => {
  const repository = createInventoryLedgerRepository(prisma);
  const [items, total] = await Promise.all([
    repository.listIngredients(pagination),
    repository.countIngredients(),
  ]);

  return {
    items,
    pagination: buildPagination({ ...pagination, total }),
  };
};

const updateIngredient = async (id, data) => {
  const existing = await prisma.ingredient.findUnique({ where: { id } });

  if (!existing) {
    throw new AppError("Ingredient not found", 404);
  }

  const nextName = data.name !== undefined ? data.name : existing.name;
  const nextSku = data.sku !== undefined ? data.sku : existing.sku;
  const nextBaseUnit =
    data.baseUnit !== undefined ? data.baseUnit : existing.baseUnit;
  const nextMinimumQuantity =
    data.minimumQuantity !== undefined
      ? data.minimumQuantity
      : existing.minimumQuantity;

  if (nextName.trim().toLowerCase() !== existing.name.trim().toLowerCase()) {
    const nameConflict = await prisma.ingredient.findFirst({
      where: { name: nextName, NOT: { id } },
    });

    if (nameConflict) {
      throw new AppError(
        `Another ingredient is already named "${nextName}"`,
        409,
      );
    }
  }

  if (nextSku && nextSku !== existing.sku) {
    const skuConflict = await prisma.ingredient.findFirst({
      where: { sku: nextSku, NOT: { id } },
    });

    if (skuConflict) {
      throw new AppError(
        `Another ingredient already uses SKU "${nextSku}"`,
        409,
      );
    }
  }

  if (nextBaseUnit !== existing.baseUnit) {
    const [recipeUsage, movementUsage] = await Promise.all([
      prisma.recipeItem.count({ where: { ingredientId: id } }),
      prisma.stockMovement.count({ where: { ingredientId: id } }),
    ]);

    if (
      recipeUsage > 0 ||
      movementUsage > 0 ||
      Number(existing.currentQuantity) !== 0
    ) {
      throw new AppError(
        "Can't change the base unit after this ingredient has stock history or is used in a recipe. Create a new ingredient instead.",
        409,
      );
    }
  }

  return prisma.ingredient.update({
    where: { id },
    data: {
      name: nextName,
      sku: nextSku,
      baseUnit: nextBaseUnit,
      minimumQuantity: nextMinimumQuantity,
    },
  });
};

const deleteIngredient = async (id) => {
  const existing = await prisma.ingredient.findUnique({ where: { id } });

  if (!existing || !existing.isActive) {
    throw new AppError("Ingredient not found", 404);
  }

  const [activeRecipeUsage, directStockUsage] = await Promise.all([
    prisma.recipeItem.findFirst({
      where: { ingredientId: id, recipe: { isActive: true } },
      include: { recipe: { include: { product: true } } },
    }),
    prisma.product.findFirst({
      where: { directStockIngredientId: id, deletedAt: null },
    }),
  ]);

  if (activeRecipeUsage) {
    throw new AppError(
      `Can't delete: still used in the recipe for "${activeRecipeUsage.recipe.product?.name || "a product"}". Remove it from that recipe first.`,
      409,
    );
  }

  if (directStockUsage) {
    throw new AppError(
      `Can't delete: still linked as the direct-stock ingredient for "${directStockUsage.name}". Unlink it from that product first.`,
      409,
    );
  }

  await prisma.ingredient.update({
    where: { id },
    data: { isActive: false },
  });

  return { id };
};

module.exports = {
  buildPagination,
  createIngredient,
  listIngredients,
  updateIngredient,
  deleteIngredient,
};
