const prisma = require("../../config/prisma");
const { resolveProductStockAlert, syncProductStockAlert } = require("../../services/alert.service");
const { sendError, sendSuccess, handleControllerError } = require("../../utils/response");

const parseId = (value) => {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
};

const normalizeRequiredString = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  return normalizedValue ? normalizedValue : null;
};

const normalizeOptionalString = (value) => {
  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  return normalizedValue ? normalizedValue : null;
};

const PRODUCT_STOCK_UNITS = new Set(["cope", "shishe", "litra", "kg"]);

const normalizeStockUnit = (value) => {
  const normalizedValue = normalizeOptionalString(value) || "cope";

  return PRODUCT_STOCK_UNITS.has(normalizedValue) ? normalizedValue : null;
};

const parsePrice = (value) => {
  const price = Number(value);

  if (Number.isNaN(price) || price < 0) {
    return null;
  }

  return price;
};

const parseStock = (value) => {
  const stock = Number(value);

  if (!Number.isInteger(stock) || stock < 0) {
    return null;
  }

  return stock;
};

const parseOptionalPositiveInteger = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue = Number(value);

  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    return null;
  }

  return numericValue;
};

exports.getAllProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        deletedAt: null,
      },
      include: { category: true, directStockIngredient: true },
      orderBy: { createdAt: "desc" },
    });

    return sendSuccess(res, 200, "Products retrieved successfully", products);
  } catch (error) {
    return handleControllerError(res, error, "Get all products error");
  }
};

exports.getProductById = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      return sendError(res, 400, "Invalid product id");
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: { category: true, directStockIngredient: true },
    });

    if (!product || product.deletedAt) {
      return sendError(res, 404, "Product not found");
    }

    return sendSuccess(res, 200, "Product retrieved successfully", product);
  } catch (error) {
    return handleControllerError(res, error, "Get product by id error");
  }
};

exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      stock,
      stockUnit,
      unitsPerPackage,
      imageUrl,
      categoryId,
      directStockIngredientId,
      isAvailable,
    } = req.body;

    const normalizedName = normalizeRequiredString(name);
    const normalizedPrice = parsePrice(price);
    const normalizedCategoryId = parseId(categoryId);
    const normalizedDirectStockIngredientId =
      directStockIngredientId === undefined ||
      directStockIngredientId === null ||
      directStockIngredientId === ""
        ? null
        : parseId(directStockIngredientId);
    const normalizedStock = stock !== undefined ? parseStock(stock) : 0;
    const normalizedStockUnit = normalizeStockUnit(stockUnit);
    const normalizedUnitsPerPackage = parseOptionalPositiveInteger(unitsPerPackage);

    if (!normalizedName || price === undefined || !normalizedCategoryId) {
      return sendError(res, 400, "Name, price and categoryId are required");
    }

    if (normalizedPrice === null) {
      return sendError(res, 400, "Price must be a valid number greater than or equal to 0");
    }

    if (stock !== undefined && normalizedStock === null) {
      return sendError(res, 400, "Stock must be a whole number greater than or equal to 0");
    }

    if (
      directStockIngredientId !== undefined &&
      directStockIngredientId !== null &&
      directStockIngredientId !== "" &&
      !normalizedDirectStockIngredientId
    ) {
      return sendError(
        res,
        400,
        "directStockIngredientId must be a valid positive integer or empty",
      );
    }

    if (!normalizedStockUnit) {
      return sendError(res, 400, "Stock unit must be one of: cope, shishe, litra, kg");
    }

    if (
      unitsPerPackage !== undefined &&
      unitsPerPackage !== null &&
      unitsPerPackage !== "" &&
      normalizedUnitsPerPackage === null
    ) {
      return sendError(res, 400, "Units per package must be a positive whole number");
    }

    if (description !== undefined && description !== null && typeof description !== "string") {
      return sendError(res, 400, "Description must be a string or null");
    }

    if (imageUrl !== undefined && imageUrl !== null && typeof imageUrl !== "string") {
      return sendError(res, 400, "Image URL must be a string or null");
    }

    if (isAvailable !== undefined && typeof isAvailable !== "boolean") {
      return sendError(res, 400, "isAvailable must be a boolean value");
    }

    const category = await prisma.category.findUnique({
      where: { id: normalizedCategoryId },
    });

    if (!category) {
      return sendError(res, 404, "Category not found");
    }

    if (normalizedDirectStockIngredientId) {
      const ingredient = await prisma.ingredient.findFirst({
        where: { id: normalizedDirectStockIngredientId, isActive: true },
      });

      if (!ingredient) {
        return sendError(res, 404, "Direct stock ingredient not found");
      }
    }

    const product = await prisma.product.create({
      data: {
        name: normalizedName,
        description: description !== undefined ? normalizeOptionalString(description) : null,
        price: normalizedPrice,
        stock: normalizedStock,
        stockUnit: normalizedStockUnit,
        unitsPerPackage: normalizedUnitsPerPackage,
        imageUrl: imageUrl !== undefined ? normalizeOptionalString(imageUrl) : null,
        categoryId: normalizedCategoryId,
        directStockIngredientId: normalizedDirectStockIngredientId,
        isAvailable: isAvailable !== undefined ? isAvailable : true,
      },
      include: { category: true, directStockIngredient: true },
    });

    await syncProductStockAlert(product);

    return sendSuccess(res, 201, "Product created successfully", product);
  } catch (error) {
    return handleControllerError(res, error, "Create product error");
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      return sendError(res, 400, "Invalid product id");
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct || existingProduct.deletedAt) {
      return sendError(res, 404, "Product not found");
    }

    const {
      name,
      description,
      price,
      stock,
      stockUnit,
      unitsPerPackage,
      imageUrl,
      categoryId,
      directStockIngredientId,
      isAvailable,
    } = req.body;

    const data = {};

    if (name !== undefined) {
      const normalizedName = normalizeRequiredString(name);

      if (!normalizedName) {
        return sendError(res, 400, "Name cannot be empty");
      }

      data.name = normalizedName;
    }

    if (description !== undefined) {
      if (description !== null && typeof description !== "string") {
        return sendError(res, 400, "Description must be a string or null");
      }

      data.description = normalizeOptionalString(description);
    }

    if (price !== undefined) {
      const normalizedPrice = parsePrice(price);

      if (normalizedPrice === null) {
        return sendError(res, 400, "Price must be a valid number greater than or equal to 0");
      }

      data.price = normalizedPrice;
    }

    if (stock !== undefined) {
      const normalizedStock = parseStock(stock);

      if (normalizedStock === null) {
        return sendError(res, 400, "Stock must be a whole number greater than or equal to 0");
      }

      data.stock = normalizedStock;
    }

    if (stockUnit !== undefined) {
      const normalizedStockUnit = normalizeStockUnit(stockUnit);

      if (!normalizedStockUnit) {
        return sendError(res, 400, "Stock unit must be one of: cope, shishe, litra, kg");
      }

      data.stockUnit = normalizedStockUnit;
    }

    if (unitsPerPackage !== undefined) {
      const normalizedUnitsPerPackage = parseOptionalPositiveInteger(unitsPerPackage);

      if (
        unitsPerPackage !== null &&
        unitsPerPackage !== "" &&
        normalizedUnitsPerPackage === null
      ) {
        return sendError(res, 400, "Units per package must be a positive whole number");
      }

      data.unitsPerPackage = normalizedUnitsPerPackage;
    }

    if (imageUrl !== undefined) {
      if (imageUrl !== null && typeof imageUrl !== "string") {
        return sendError(res, 400, "Image URL must be a string or null");
      }

      data.imageUrl = normalizeOptionalString(imageUrl);
    }

    if (categoryId !== undefined) {
      if (categoryId === null || categoryId === "") {
        data.categoryId = null;
      } else {
        const normalizedCategoryId = parseId(categoryId);

        if (!normalizedCategoryId) {
          return sendError(res, 400, "categoryId must be a valid positive integer or null");
        }

        const category = await prisma.category.findUnique({
          where: { id: normalizedCategoryId },
        });

        if (!category) {
          return sendError(res, 404, "Category not found");
        }

        data.categoryId = normalizedCategoryId;
      }
    }

    if (directStockIngredientId !== undefined) {
      if (directStockIngredientId === null || directStockIngredientId === "") {
        data.directStockIngredientId = null;
      } else {
        const normalizedDirectStockIngredientId = parseId(directStockIngredientId);

        if (!normalizedDirectStockIngredientId) {
          return sendError(
            res,
            400,
            "directStockIngredientId must be a valid positive integer or null",
          );
        }

        const ingredient = await prisma.ingredient.findFirst({
          where: { id: normalizedDirectStockIngredientId, isActive: true },
        });

        if (!ingredient) {
          return sendError(res, 404, "Direct stock ingredient not found");
        }

        data.directStockIngredientId = normalizedDirectStockIngredientId;
      }
    }

    if (isAvailable !== undefined) {
      if (typeof isAvailable !== "boolean") {
        return sendError(res, 400, "isAvailable must be a boolean value");
      }

      data.isAvailable = isAvailable;
    }

    if (Object.keys(data).length === 0) {
      return sendError(res, 400, "At least one field is required to update the product");
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data,
      include: { category: true, directStockIngredient: true },
    });

    await syncProductStockAlert(updatedProduct);

    return sendSuccess(res, 200, "Product updated successfully", updatedProduct);
  } catch (error) {
    return handleControllerError(res, error, "Update product error");
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      return sendError(res, 400, "Invalid product id");
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct || existingProduct.deletedAt) {
      return sendError(res, 404, "Product not found");
    }

    await prisma.product.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isAvailable: false,
      },
    });

    await resolveProductStockAlert(id);

    return sendSuccess(res, 200, "Product deleted successfully", null);
  } catch (error) {
    return handleControllerError(res, error, "Delete product error");
  }
};

exports.updateProductStock = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      return sendError(res, 400, "Invalid product id");
    }

    const { delta, stock } = req.body || {};

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct || existingProduct.deletedAt) {
      return sendError(res, 404, "Product not found");
    }

    const hasDelta = delta !== undefined;
    const hasStock = stock !== undefined;

    if (!hasDelta && !hasStock) {
      return sendError(
        res,
        400,
        "Provide either delta (increase/decrease) or stock (absolute value)",
      );
    }

    if (hasDelta && hasStock) {
      return sendError(res, 400, "Provide only one: delta or stock");
    }

    let nextStock;

    if (hasStock) {
      const normalizedStock = parseStock(stock);

      if (normalizedStock === null) {
        return sendError(res, 400, "stock must be a whole number greater than or equal to 0");
      }

      nextStock = normalizedStock;
    } else {
      const normalizedDelta = Number(delta);

      if (!Number.isInteger(normalizedDelta)) {
        return sendError(res, 400, "delta must be a whole number");
      }

      nextStock = existingProduct.stock + normalizedDelta;
    }

    if (nextStock < 0) {
      return sendError(res, 400, "Resulting stock cannot be negative");
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        stock: nextStock,
      },
      include: { category: true, directStockIngredient: true },
    });

    await syncProductStockAlert(updatedProduct);

    return sendSuccess(res, 200, "Product stock updated successfully", updatedProduct);
  } catch (error) {
    return handleControllerError(res, error, "Update product stock error");
  }
};
