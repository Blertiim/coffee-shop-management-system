const prisma = require("../../config/prisma");
const { createInventoryLedgerRepository } = require("./inventory-ledger.repository");
const { buildPagination } = require("./ingredient.service");

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

module.exports = {
  listStockMovements,
};
