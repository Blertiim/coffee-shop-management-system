const { Prisma } = require("@prisma/client");

const prisma = require("../../config/prisma");
const { syncInventoryAlert } = require("../../services/alert.service");
const {
  handleControllerError,
  sendError,
  sendSuccess,
} = require("../../utils/response");
const {
  validateCreateInventoryPayload,
  validateInventoryId,
  validateUpdateInventoryPayload,
} = require("./inventory.validation");

exports.getAllInventory = async (req, res) => {
  try {
    const inventory = await prisma.inventory.findMany({
      include: {
        supplier: true,
      },
      orderBy: [{ itemName: "asc" }],
    });

    return sendSuccess(
      res,
      200,
      "Inventory items retrieved successfully",
      inventory
    );
  } catch (error) {
    return handleControllerError(res, error, "Get all inventory error");
  }
};

exports.getInventoryById = async (req, res) => {
  try {
    const id = validateInventoryId(req.params.id);

    const inventoryItem = await prisma.inventory.findUnique({
      where: { id },
      include: {
        supplier: true,
      },
    });

    if (!inventoryItem) {
      return sendError(res, 404, "Inventory item not found");
    }

    return sendSuccess(
      res,
      200,
      "Inventory item retrieved successfully",
      inventoryItem
    );
  } catch (error) {
    return handleControllerError(res, error, "Get inventory by id error");
  }
};

exports.createInventoryItem = async (req, res) => {
  try {
    const data = validateCreateInventoryPayload(req.body);

    const supplier = await prisma.supplier.findUnique({
      where: { id: data.supplierId },
      select: { id: true },
    });

    if (!supplier) {
      return sendError(res, 404, "Supplier not found");
    }

    const inventoryItem = await prisma.inventory.create({
      data,
      include: {
        supplier: true,
      },
    });

    await syncInventoryAlert(inventoryItem);

    return sendSuccess(
      res,
      201,
      "Inventory item created successfully",
      inventoryItem
    );
  } catch (error) {
    return handleControllerError(res, error, "Create inventory item error");
  }
};

exports.updateInventoryItem = async (req, res) => {
  try {
    const id = validateInventoryId(req.params.id);
    const data = validateUpdateInventoryPayload(req.body);

    const existingInventoryItem = await prisma.inventory.findUnique({
      where: { id },
    });

    if (!existingInventoryItem) {
      return sendError(res, 404, "Inventory item not found");
    }

    if (data.supplierId !== undefined) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: data.supplierId },
        select: { id: true },
      });

      if (!supplier) {
        return sendError(res, 404, "Supplier not found");
      }
    }

    const inventoryItem = await prisma.inventory.update({
      where: { id },
      data,
      include: {
        supplier: true,
      },
    });

    await syncInventoryAlert(inventoryItem);

    return sendSuccess(
      res,
      200,
      "Inventory item updated successfully",
      inventoryItem
    );
  } catch (error) {
    return handleControllerError(res, error, "Update inventory item error");
  }
};

exports.deleteInventoryItem = async (req, res) => {
  try {
    const id = validateInventoryId(req.params.id);

    const existingInventoryItem = await prisma.inventory.findUnique({
      where: { id },
    });

    if (!existingInventoryItem) {
      return sendError(res, 404, "Inventory item not found");
    }

    await prisma.inventory.delete({
      where: { id },
    });

    await prisma.systemAlert.updateMany({
      where: {
        type: "inventory.low",
        entityType: "inventory",
        entityId: String(id),
        status: "open",
      },
      data: {
        status: "resolved",
        resolvedAt: new Date(),
      },
    });

    return sendSuccess(res, 200, "Inventory item deleted successfully", null);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return sendError(
        res,
        400,
        "Cannot delete inventory item linked to existing supplier records"
      );
    }

    return handleControllerError(res, error, "Delete inventory item error");
  }
};
