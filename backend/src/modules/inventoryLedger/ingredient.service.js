const prisma = require("../../config/prisma");
const { createInventoryLedgerRepository } = require("./inventory-ledger.repository");

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

module.exports = {
  buildPagination,
  createIngredient,
  listIngredients,
};
