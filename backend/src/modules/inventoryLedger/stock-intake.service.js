const prisma = require("../../config/prisma");
const AppError = require("../../utils/app-error");
const { createInventoryLedgerRepository } = require("./inventory-ledger.repository");
const { buildPagination } = require("./ingredient.service");
const {
  applyIngredientMovement,
  resolveBaseQuantity,
} = require("./inventory-engine.service");
const { assertBaseUnit } = require("./unit-conversion");

const resolveProductStockIngredient = async ({ tx, repository, productId }) => {
  const product = await repository.findProductById(productId);

  if (!product || product.deletedAt) {
    throw new AppError("Product not found", 404);
  }

  if (product.directStockIngredient) {
    return {
      ingredient: product.directStockIngredient,
      product,
    };
  }

  let ingredient = await repository.findIngredientByName(product.name);

  if (!ingredient) {
    ingredient = await repository.createIngredient({
      name: product.name,
      sku: product.sku || null,
      baseUnit: "pcs",
      minimumQuantity: 0,
    });
  }

  await tx.product.update({
    where: { id: product.id },
    data: { directStockIngredientId: ingredient.id },
  });

  return {
    ingredient,
    product: {
      ...product,
      directStockIngredientId: ingredient.id,
      directStockIngredient: ingredient,
    },
  };
};

const buildIntakeItem = ({ item, ingredient, product }) => {
  const baseUnit = assertBaseUnit(ingredient.baseUnit, "Ingredient base unit");
  const isPackagePurchase = item.purchasedUnit === "paketa";

  if (isPackagePurchase && !product) {
    throw new AppError("Package purchases must be linked to a product");
  }

  if (isPackagePurchase && Number(product.unitsPerPackage || 0) <= 0) {
    throw new AppError(`Set units per package for ${product.name} before receiving paketa`);
  }

  if (isPackagePurchase && baseUnit !== "pcs") {
    throw new AppError("Package purchases can only update piece-based stock");
  }

  const baseQuantity = isPackagePurchase
    ? Number((item.purchasedQuantity * product.unitsPerPackage).toFixed(3))
    : resolveBaseQuantity({
        quantity: item.purchasedQuantity,
        unit: item.purchasedUnit,
        baseUnit,
      });
  const lineTotal = Number((item.purchasedQuantity * item.unitCost).toFixed(2));
  const baseUnitCost = Number((lineTotal / baseQuantity).toFixed(4));

  return {
    ingredientId: ingredient.id,
    purchasedQuantity: baseQuantity,
    purchasedUnit: baseUnit,
    baseQuantity,
    baseUnit,
    unitCost: baseUnitCost,
    lineTotal,
  };
};

const createStockIntake = async ({ payload, actorId }) =>
  prisma.$transaction(async (tx) => {
    const repository = createInventoryLedgerRepository(tx);
    const supplier = await repository.findSupplierById(payload.supplierId);

    if (!supplier) {
      throw new AppError("Supplier not found", 404);
    }

    const ingredientIds = payload.items
      .map((item) => item.ingredientId)
      .filter((ingredientId) => ingredientId !== null);
    const ingredients = await repository.findIngredientsByIds(ingredientIds);
    const ingredientsById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));

    if (ingredients.length !== new Set(ingredientIds).size) {
      throw new AppError("One or more ingredients were not found", 404);
    }

    const intakeItems = [];

    for (const item of payload.items) {
      if (item.productId) {
        const { ingredient, product } = await resolveProductStockIngredient({
          tx,
          repository,
          productId: item.productId,
        });
        intakeItems.push(buildIntakeItem({ item, ingredient, product }));
        continue;
      }

      const ingredient = ingredientsById.get(item.ingredientId);
      intakeItems.push(buildIntakeItem({ item, ingredient }));
    }

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
      for (const item of intakeItems) {
        await applyIngredientMovement({
          tx,
          ingredientId: item.ingredientId,
          stockIntakeId: stockIntake.id,
          type: "IN",
          sourceType: "STOCK_INTAKE",
          sourceId: stockIntake.id,
          quantity: item.baseQuantity,
          unit: item.baseUnit,
          unitCost: item.unitCost,
          totalCost: item.lineTotal,
          reason: `Stock intake${payload.invoiceNumber ? ` ${payload.invoiceNumber}` : ""}`,
          actorId,
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

module.exports = {
  createStockIntake,
  listStockIntakes,
};
