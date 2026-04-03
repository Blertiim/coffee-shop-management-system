const prisma = require("../../config/prisma");

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

exports.getAllProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(products);
  } catch (error) {
    console.error("Get all products error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "Invalid product id" });
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(200).json(product);
  } catch (error) {
    console.error("Get product by id error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      stock,
      imageUrl,
      categoryId,
      isAvailable,
    } = req.body;

    const normalizedName = normalizeRequiredString(name);
    const normalizedPrice = parsePrice(price);
    const normalizedCategoryId = parseId(categoryId);
    const normalizedStock = stock !== undefined ? parseStock(stock) : 0;

    if (!normalizedName || price === undefined || !normalizedCategoryId) {
      return res.status(400).json({
        error: "Name, price and categoryId are required",
      });
    }

    if (normalizedPrice === null) {
      return res.status(400).json({
        error: "Price must be a valid number greater than or equal to 0",
      });
    }

    if (stock !== undefined && normalizedStock === null) {
      return res.status(400).json({
        error: "Stock must be a whole number greater than or equal to 0",
      });
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        error: "Description must be a string or null",
      });
    }

    if (
      imageUrl !== undefined &&
      imageUrl !== null &&
      typeof imageUrl !== "string"
    ) {
      return res.status(400).json({
        error: "Image URL must be a string or null",
      });
    }

    if (isAvailable !== undefined && typeof isAvailable !== "boolean") {
      return res.status(400).json({
        error: "isAvailable must be a boolean value",
      });
    }

    const category = await prisma.category.findUnique({
      where: { id: normalizedCategoryId },
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    const product = await prisma.product.create({
      data: {
        name: normalizedName,
        description:
          description !== undefined ? normalizeOptionalString(description) : null,
        price: normalizedPrice,
        stock: normalizedStock,
        imageUrl: imageUrl !== undefined ? normalizeOptionalString(imageUrl) : null,
        categoryId: normalizedCategoryId,
        isAvailable: isAvailable !== undefined ? isAvailable : true,
      },
      include: { category: true },
    });

    res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "Invalid product id" });
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    const {
      name,
      description,
      price,
      stock,
      imageUrl,
      categoryId,
      isAvailable,
    } = req.body;

    const data = {};

    if (name !== undefined) {
      const normalizedName = normalizeRequiredString(name);

      if (!normalizedName) {
        return res.status(400).json({ error: "Name cannot be empty" });
      }

      data.name = normalizedName;
    }

    if (description !== undefined) {
      if (description !== null && typeof description !== "string") {
        return res.status(400).json({
          error: "Description must be a string or null",
        });
      }

      data.description = normalizeOptionalString(description);
    }

    if (price !== undefined) {
      const normalizedPrice = parsePrice(price);

      if (normalizedPrice === null) {
        return res.status(400).json({
          error: "Price must be a valid number greater than or equal to 0",
        });
      }

      data.price = normalizedPrice;
    }

    if (stock !== undefined) {
      const normalizedStock = parseStock(stock);

      if (normalizedStock === null) {
        return res.status(400).json({
          error: "Stock must be a whole number greater than or equal to 0",
        });
      }

      data.stock = normalizedStock;
    }

    if (imageUrl !== undefined) {
      if (imageUrl !== null && typeof imageUrl !== "string") {
        return res.status(400).json({
          error: "Image URL must be a string or null",
        });
      }

      data.imageUrl = normalizeOptionalString(imageUrl);
    }

    if (categoryId !== undefined) {
      const normalizedCategoryId = parseId(categoryId);

      if (!normalizedCategoryId) {
        return res.status(400).json({
          error: "categoryId must be a valid positive integer",
        });
      }

      const category = await prisma.category.findUnique({
        where: { id: normalizedCategoryId },
      });

      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }

      data.categoryId = normalizedCategoryId;
    }

    if (isAvailable !== undefined) {
      if (typeof isAvailable !== "boolean") {
        return res.status(400).json({
          error: "isAvailable must be a boolean value",
        });
      }

      data.isAvailable = isAvailable;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        error: "At least one field is required to update the product",
      });
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data,
      include: { category: true },
    });

    res.status(200).json({
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "Invalid product id" });
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    await prisma.product.delete({
      where: { id },
    });

    res.status(200).json({
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.updateProductStock = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "Invalid product id" });
    }

    const { delta, stock } = req.body || {};

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    const hasDelta = delta !== undefined;
    const hasStock = stock !== undefined;

    if (!hasDelta && !hasStock) {
      return res.status(400).json({
        error: "Provide either delta (increase/decrease) or stock (absolute value)",
      });
    }

    if (hasDelta && hasStock) {
      return res.status(400).json({
        error: "Provide only one: delta or stock",
      });
    }

    let nextStock;

    if (hasStock) {
      const normalizedStock = parseStock(stock);

      if (normalizedStock === null) {
        return res.status(400).json({
          error: "stock must be a whole number greater than or equal to 0",
        });
      }

      nextStock = normalizedStock;
    } else {
      const normalizedDelta = Number(delta);

      if (!Number.isInteger(normalizedDelta)) {
        return res.status(400).json({
          error: "delta must be a whole number",
        });
      }

      nextStock = existingProduct.stock + normalizedDelta;
    }

    if (nextStock < 0) {
      return res.status(400).json({
        error: "Resulting stock cannot be negative",
      });
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        stock: nextStock,
      },
      include: { category: true },
    });

    return res.status(200).json({
      message: "Product stock updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Update product stock error:", error);
    return res.status(500).json({ error: "Server error" });
  }
};
