const stockIntakeInclude = {
  supplier: true,
  createdBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
    },
  },
  items: {
    include: {
      ingredient: true,
    },
    orderBy: { id: "asc" },
  },
  movements: {
    include: {
      ingredient: true,
    },
    orderBy: { createdAt: "asc" },
  },
};

const createInventoryLedgerRepository = (client) => ({
  findSupplierById: (id) =>
    client.supplier.findUnique({
      where: { id },
      select: { id: true },
    }),

  findIngredientsByIds: (ids) =>
    client.ingredient.findMany({
      where: {
        id: { in: ids },
        isActive: true,
      },
    }),

  createIngredient: (data) => client.ingredient.create({ data }),

  listIngredients: ({ skip, take }) =>
    client.ingredient.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      skip,
      take,
    }),

  countIngredients: () => client.ingredient.count(),

  createStockIntake: (data) =>
    client.stockIntake.create({
      data,
      include: stockIntakeInclude,
    }),

  getStockIntakeById: (id) =>
    client.stockIntake.findUnique({
      where: { id },
      include: stockIntakeInclude,
    }),

  listStockIntakes: ({ skip, take }) =>
    client.stockIntake.findMany({
      include: stockIntakeInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
    }),

  countStockIntakes: () => client.stockIntake.count(),

  listMovements: ({ skip, take, ingredientId }) =>
    client.stockMovement.findMany({
      where: ingredientId ? { ingredientId } : {},
      include: {
        ingredient: true,
        stockIntake: {
          select: {
            id: true,
            invoiceNumber: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
    }),

  countMovements: ({ ingredientId }) =>
    client.stockMovement.count({
      where: ingredientId ? { ingredientId } : {},
    }),

  findProductById: (id) =>
    client.product.findUnique({
      where: { id },
      select: { id: true, name: true, deletedAt: true },
    }),

  upsertRecipe: ({ productId, items, notes }) =>
    client.recipe.upsert({
      where: { productId },
      create: {
        productId,
        notes,
        items: { create: items },
      },
      update: {
        notes,
        version: { increment: 1 },
        isActive: true,
        items: {
          deleteMany: {},
          create: items,
        },
      },
      include: {
        product: true,
        items: {
          include: { ingredient: true },
          orderBy: { id: "asc" },
        },
      },
    }),

  getRecipeByProductId: (productId) =>
    client.recipe.findUnique({
      where: { productId },
      include: {
        product: true,
        items: {
          include: { ingredient: true },
          orderBy: { id: "asc" },
        },
      },
    }),

  listRecipes: ({ skip, take }) =>
    client.recipe.findMany({
      include: {
        product: true,
        items: {
          include: { ingredient: true },
          orderBy: { id: "asc" },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip,
      take,
    }),

  countRecipes: () => client.recipe.count(),
});

module.exports = {
  createInventoryLedgerRepository,
  stockIntakeInclude,
};
