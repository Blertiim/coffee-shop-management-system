const { Prisma } = require("@prisma/client");
const prisma = require("../../config/prisma");
const { sendError, sendSuccess, handleControllerError } = require("../../utils/response");

const parseId = (value) => {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
};

const normalizeCategoryName = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const name = value.trim();

  return name ? name : null;
};

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { createdAt: "desc" },
    });

    return sendSuccess(res, 200, "Categories retrieved successfully", categories);
  } catch (error) {
    return handleControllerError(res, error, "Get all categories error");
  }
};

exports.getCategoryById = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      return sendError(res, 400, "Invalid category id");
    }

    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      return sendError(res, 404, "Category not found");
    }

    return sendSuccess(res, 200, "Category retrieved successfully", category);
  } catch (error) {
    return handleControllerError(res, error, "Get category by id error");
  }
};

exports.createCategory = async (req, res) => {
  try {
    const name = normalizeCategoryName(req.body.name);

    if (!name) {
      return sendError(res, 400, "Category name is required");
    }

    const category = await prisma.category.create({
      data: { name },
    });

    return sendSuccess(res, 201, "Category created successfully", category);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return sendError(res, 409, "Category name already exists");
    }

    return handleControllerError(res, error, "Create category error");
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      return sendError(res, 400, "Invalid category id");
    }

    const name = normalizeCategoryName(req.body.name);

    if (!name) {
      return sendError(res, 400, "Category name is required");
    }

    const existingCategory = await prisma.category.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      return sendError(res, 404, "Category not found");
    }

    const category = await prisma.category.update({
      where: { id },
      data: { name },
    });

    return sendSuccess(res, 200, "Category updated successfully", category);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return sendError(res, 409, "Category name already exists");
    }

    return handleControllerError(res, error, "Update category error");
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      return sendError(res, 400, "Invalid category id");
    }

    const existingCategory = await prisma.category.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      return sendError(res, 404, "Category not found");
    }

    const result = await prisma.$transaction(async (tx) => {
      const affectedProducts = await tx.product.findMany({
        where: { categoryId: id },
        select: { id: true },
      });

      if (affectedProducts.length > 0) {
        await tx.product.updateMany({
          where: { categoryId: id },
          data: { categoryId: null },
        });
      }

      await tx.category.delete({
        where: { id },
      });

      return {
        uncategorizedProductIds: affectedProducts.map((product) => product.id),
        uncategorizedCount: affectedProducts.length,
      };
    });

    return sendSuccess(res, 200, "Category deleted successfully", result);
  } catch (error) {
    return handleControllerError(res, error, "Delete category error");
  }
};
