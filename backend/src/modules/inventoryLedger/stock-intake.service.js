const prisma = require("../../config/prisma");
const AppError = require("../../utils/app-error");
const { createInventoryLedgerRepository } = require("./inventory-ledger.repository");
const { buildPagination } = require("./ingredient.service");
const {
  applyIngredientMovement,
  resolveBaseQuantity,
} = require("./inventory-engine.service");
const { assertBaseUnit } = require("./unit-conversion");

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

    const intakeItems = payload.items.map((item) => {
      const ingredient = ingredientsById.get(item.ingredientId);
      const baseUnit = assertBaseUnit(ingredient.baseUnit, "Ingredient base unit");
      const baseQuantity = resolveBaseQuantity({
        quantity: item.purchasedQuantity,
        unit: item.purchasedUnit,
        baseUnit,
      });
      const lineTotal = Number((item.purchasedQuantity * item.unitCost).toFixed(2));
      const baseUnitCost = Number((lineTotal / baseQuantity).toFixed(4));

      return {
        ingredientId: item.ingredientId,
        purchasedQuantity: baseQuantity,
        purchasedUnit: baseUnit,
        baseQuantity,
        baseUnit,
        unitCost: baseUnitCost,
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
