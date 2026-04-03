const { Prisma } = require("@prisma/client");

const prisma = require("../../config/prisma");
const {
  handleControllerError,
  sendError,
  sendSuccess,
} = require("../../utils/response");
const {
  validateCreateTablePayload,
  validateTableId,
  validateUpdateTablePayload,
} = require("./table.validation");

exports.getAllTables = async (req, res) => {
  try {
    const tables = await prisma.table.findMany({
      orderBy: { number: "asc" },
    });

    return sendSuccess(res, 200, "Tables retrieved successfully", tables);
  } catch (error) {
    return handleControllerError(res, error, "Get all tables error");
  }
};

exports.getTableById = async (req, res) => {
  try {
    const id = validateTableId(req.params.id);

    const table = await prisma.table.findUnique({
      where: { id },
    });

    if (!table) {
      return sendError(res, 404, "Table not found");
    }

    return sendSuccess(res, 200, "Table retrieved successfully", table);
  } catch (error) {
    return handleControllerError(res, error, "Get table by id error");
  }
};

exports.createTable = async (req, res) => {
  try {
    const data = validateCreateTablePayload(req.body);

    const table = await prisma.table.create({
      data,
    });

    return sendSuccess(res, 201, "Table created successfully", table);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        message: "Table number already exists",
        data: null,
      });
    }

    return handleControllerError(res, error, "Create table error");
  }
};

exports.updateTable = async (req, res) => {
  try {
    const id = validateTableId(req.params.id);
    const data = validateUpdateTablePayload(req.body);

    const existingTable = await prisma.table.findUnique({
      where: { id },
    });

    if (!existingTable) {
      return res.status(404).json({
        success: false,
        message: "Table not found",
        data: null,
      });
    }

    const updatedTable = await prisma.table.update({
      where: { id },
      data,
    });

    return sendSuccess(res, 200, "Table updated successfully", updatedTable);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        message: "Table number already exists",
        data: null,
      });
    }

    return handleControllerError(res, error, "Update table error");
  }
};

exports.deleteTable = async (req, res) => {
  try {
    const id = validateTableId(req.params.id);

    const existingTable = await prisma.table.findUnique({
      where: { id },
    });

    if (!existingTable) {
      return res.status(404).json({
        success: false,
        message: "Table not found",
        data: null,
      });
    }

    await prisma.table.delete({
      where: { id },
    });

    return sendSuccess(res, 200, "Table deleted successfully", null);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete a table that is linked to orders or reservations",
        data: null,
      });
    }

    return handleControllerError(res, error, "Delete table error");
  }
};
