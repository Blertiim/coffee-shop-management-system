const prisma = require("../../config/prisma");
const AppError = require("../../utils/app-error");
const { createInventoryLedgerRepository } = require("./inventory-ledger.repository");
const { convertToBaseQuantity } = require("./unit-conversion");

const toNumber = (value) => Number(value || 0);

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

const createStockIntake = async ({ payload, actorId }) =>
  prisma.$transaction(async (tx) => {
    const repository = createInventoryLedgerRepository(tx);
    const supplier = await repository.findSupplierById(payload.supplierId);

    if (!supplier) {
      throw new AppError("Supplier not found", 404);
    }

    const ingredientIds = payload.items.map((item) => item.ingredientId);
    const ingredients = await repository.findIngredientsByIds(ingredientIds);
    const ingredientsById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));

    if (ingredients.length !== new Set(ingredientIds).size) {
      throw new AppError("One or more ingredients were not found", 404);
    }

    const movementPayloads = [];
    const intakeItems = payload.items.map((item) => {
      const ingredient = ingredientsById.get(item.ingredientId);
      const baseQuantity = convertToBaseQuantity(
        item.purchasedQuantity,
        item.purchasedUnit,
        ingredient.baseUnit
      );
      const lineTotal = Number((item.purchasedQuantity * item.unitCost).toFixed(2));

      movementPayloads.push({
        ingredient,
        baseQuantity,
        unitCost: item.unitCost,
        lineTotal,
      });

      return {
        ingredientId: item.ingredientId,
        purchasedQuantity: item.purchasedQuantity,
        purchasedUnit: item.purchasedUnit,
        baseQuantity,
        baseUnit: ingredient.baseUnit,
        unitCost: item.unitCost,
        lineTotal,
      };
    });

    const totalCost = Number(
      intakeItems.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2)
    );

    const stockIntake = await tx.stockIntake.create({
      data: {
        supplierId: payload.supplierId,
        invoiceNumber: payload.invoiceNumber,
        notes: payload.notes,
        createdById: actorId,
        status: payload.confirm ? "confirmed" : "draft",
        totalCost,
        confirmedAt: payload.confirm ? new Date() : null,
        items: {
          create: intakeItems,
        },
      },
      include: {
        items: true,
      },
    });

    if (payload.confirm) {
      for (const movement of movementPayloads) {
        const previousStock = toNumber(movement.ingredient.currentQuantity);
        const newStock = Number((previousStock + movement.baseQuantity).toFixed(3));

        await tx.ingredient.update({
          where: { id: movement.ingredient.id },
          data: {
            currentQuantity: newStock,
            averageCost: movement.unitCost,
          },
        });

        await tx.stockMovement.create({
          data: {
            ingredientId: movement.ingredient.id,
            stockIntakeId: stockIntake.id,
            type: "IN",
            sourceType: "STOCK_INTAKE",
            sourceId: String(stockIntake.id),
            quantity: movement.baseQuantity,
            unit: movement.ingredient.baseUnit,
            previousStock,
            newStock,
            unitCost: movement.unitCost,
            totalCost: movement.lineTotal,
            reason: `Stock intake${payload.invoiceNumber ? ` ${payload.invoiceNumber}` : ""}`,
            createdById: actorId,
          },
        });
      }
    }

    return repository.getStockIntakeById(stockIntake.id);
  });

const listStockIntakes = async (pagination) => {
  const repository = createInventoryLedgerRepository(prisma);
  const [items, total] = await Promise.all([
    repository.listStockIntakes(pagination),
    repository.countStockIntakes(),
  ]);

  return {
    items,
    pagination: buildPagination({ ...pagination, total }),
  };
};

const listStockMovements = async ({ pagination, ingredientId }) => {
  const repository = createInventoryLedgerRepository(prisma);
  const [items, total] = await Promise.all([
    repository.listMovements({ ...pagination, ingredientId }),
    repository.countMovements({ ingredientId }),
  ]);

  return {
    items,
    pagination: buildPagination({ ...pagination, total }),
  };
};

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
        quantity: convertToBaseQuantity(item.quantity, item.unit, ingredient.baseUnit),
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

  for (const orderItem of orderItems) {
    const recipe = recipesByProductId.get(orderItem.productId);

    if (!recipe) {
      continue;
    }

    for (const recipeItem of recipe.items) {
      const previousStock = toNumber(recipeItem.ingredient.currentQuantity);
      const quantity = Number((toNumber(recipeItem.quantity) * orderItem.quantity).toFixed(3));
      const newStock = Number((previousStock - quantity).toFixed(3));

      if (newStock < 0) {
        throw new AppError(
          `Not enough ${recipeItem.ingredient.name} for ${recipe.product.name}`
        );
      }

      await tx.ingredient.update({
        where: { id: recipeItem.ingredientId },
        data: { currentQuantity: newStock },
      });

      await tx.stockMovement.create({
        data: {
          ingredientId: recipeItem.ingredientId,
          type: "OUT",
          sourceType: "ORDER",
          sourceId: String(sourceId || ""),
          quantity,
          unit: recipeItem.ingredient.baseUnit,
          previousStock,
          newStock,
          reason: `${recipe.product.name} x${orderItem.quantity}`,
          createdById: actorId || null,
        },
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

    if (!recipe) {
      continue;
    }

    for (const recipeItem of recipe.items) {
      const previousStock = toNumber(recipeItem.ingredient.currentQuantity);
      const quantity = Number((toNumber(recipeItem.quantity) * orderItem.quantity).toFixed(3));
      const newStock = Number((previousStock + quantity).toFixed(3));

      await tx.ingredient.update({
        where: { id: recipeItem.ingredientId },
        data: { currentQuantity: newStock },
      });

      await tx.stockMovement.create({
        data: {
          ingredientId: recipeItem.ingredientId,
          type: "IN",
          sourceType: "ORDER_CANCEL_RESTORE",
          sourceId: String(sourceId || ""),
          quantity,
          unit: recipeItem.ingredient.baseUnit,
          previousStock,
          newStock,
          reason: `Restored ${recipe.product.name} x${orderItem.quantity}`,
          createdById: actorId || null,
        },
      });
    }
  }
};

module.exports = {
  consumeIngredientsForOrderItems,
  createIngredient,
  createStockIntake,
  listIngredients,
  listRecipes,
  listStockIntakes,
  listStockMovements,
  restoreIngredientsForOrderItems,
  upsertRecipe,
};
