const { Prisma } = require("@prisma/client");

const prisma = require("../../config/prisma");
const {
  handleControllerError,
  sendError,
  sendSuccess,
} = require("../../utils/response");
const { normalizeRole } = require("../../middlewares/role.middleware");
const {
  validateAssignTablePayload,
  validateBulkAssignPayload,
  validateCreateTablePayload,
  validateTableId,
  validateUpdateTablePayload,
} = require("./table.validation");

const tableInclude = {
  assignedWaiter: {
    select: {
      id: true,
      fullName: true,
      role: true,
      status: true,
    },
  },
};

const ensureWaiterUser = async (tx, waiterId) => {
  if (!waiterId) {
    return null;
  }

  const waiter = await tx.user.findUnique({
    where: { id: waiterId },
    select: {
      id: true,
      role: true,
      status: true,
    },
  });

  if (!waiter) {
    throw new Error("WAITER_NOT_FOUND");
  }

  if (normalizeRole(waiter.role) !== "waiter") {
    throw new Error("WAITER_ROLE_INVALID");
  }

  return waiter;
};

exports.getAllTables = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    const userRole = normalizeRole(req.user && req.user.role);

    let where = {};

    if (userRole === "waiter" && userId) {
      const assignedTablesCount = await prisma.table.count({
        where: { assignedWaiterId: userId },
      });

      if (assignedTablesCount > 0) {
        where = { assignedWaiterId: userId };
      }
    }

    const tables = await prisma.table.findMany({
      where,
      include: tableInclude,
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
      include: tableInclude,
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

    const table = await prisma.$transaction(async (tx) => {
      if (data.assignedWaiterId) {
        try {
          await ensureWaiterUser(tx, data.assignedWaiterId);
        } catch (lookupError) {
          if (lookupError.message === "WAITER_NOT_FOUND") {
            throw new Error("ASSIGNED_WAITER_NOT_FOUND");
          }

          if (lookupError.message === "WAITER_ROLE_INVALID") {
            throw new Error("ASSIGNED_WAITER_ROLE_INVALID");
          }

          throw lookupError;
        }
      }

      return tx.table.create({
        data,
        include: tableInclude,
      });
    });

    return sendSuccess(res, 201, "Table created successfully", table);
  } catch (error) {
    if (error.message === "ASSIGNED_WAITER_NOT_FOUND") {
      return sendError(res, 404, "Assigned waiter not found");
    }

    if (error.message === "ASSIGNED_WAITER_ROLE_INVALID") {
      return sendError(res, 400, "Assigned user must have waiter role");
    }

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

    const updatedTable = await prisma.$transaction(async (tx) => {
      if (data.assignedWaiterId !== undefined && data.assignedWaiterId !== null) {
        try {
          await ensureWaiterUser(tx, data.assignedWaiterId);
        } catch (lookupError) {
          if (lookupError.message === "WAITER_NOT_FOUND") {
            throw new Error("ASSIGNED_WAITER_NOT_FOUND");
          }

          if (lookupError.message === "WAITER_ROLE_INVALID") {
            throw new Error("ASSIGNED_WAITER_ROLE_INVALID");
          }

          throw lookupError;
        }
      }

      return tx.table.update({
        where: { id },
        data,
        include: tableInclude,
      });
    });

    return sendSuccess(res, 200, "Table updated successfully", updatedTable);
  } catch (error) {
    if (error.message === "ASSIGNED_WAITER_NOT_FOUND") {
      return sendError(res, 404, "Assigned waiter not found");
    }

    if (error.message === "ASSIGNED_WAITER_ROLE_INVALID") {
      return sendError(res, 400, "Assigned user must have waiter role");
    }

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

exports.assignTableToWaiter = async (req, res) => {
  try {
    const id = validateTableId(req.params.id);
    const { waiterId } = validateAssignTablePayload(req.body);

    const updatedTable = await prisma.$transaction(async (tx) => {
      const table = await tx.table.findUnique({ where: { id } });

      if (!table) {
        throw new Error("TABLE_NOT_FOUND");
      }

      if (waiterId !== null) {
        try {
          await ensureWaiterUser(tx, waiterId);
        } catch (lookupError) {
          if (lookupError.message === "WAITER_NOT_FOUND") {
            throw new Error("WAITER_NOT_FOUND");
          }

          if (lookupError.message === "WAITER_ROLE_INVALID") {
            throw new Error("WAITER_ROLE_INVALID");
          }

          throw lookupError;
        }
      }

      return tx.table.update({
        where: { id },
        data: {
          assignedWaiterId: waiterId,
        },
        include: tableInclude,
      });
    });

    return sendSuccess(
      res,
      200,
      waiterId ? "Table assigned successfully" : "Table unassigned successfully",
      updatedTable
    );
  } catch (error) {
    if (error.message === "TABLE_NOT_FOUND") {
      return sendError(res, 404, "Table not found");
    }

    if (error.message === "WAITER_NOT_FOUND") {
      return sendError(res, 404, "Waiter not found");
    }

    if (error.message === "WAITER_ROLE_INVALID") {
      return sendError(res, 400, "Selected user must have waiter role");
    }

    return handleControllerError(res, error, "Assign table error");
  }
};

exports.setWaiterTableAssignments = async (req, res) => {
  try {
    const { waiterId, tableIds } = validateBulkAssignPayload(req.body);

    const result = await prisma.$transaction(async (tx) => {
      try {
        await ensureWaiterUser(tx, waiterId);
      } catch (lookupError) {
        if (lookupError.message === "WAITER_NOT_FOUND") {
          throw new Error("WAITER_NOT_FOUND");
        }

        if (lookupError.message === "WAITER_ROLE_INVALID") {
          throw new Error("WAITER_ROLE_INVALID");
        }

        throw lookupError;
      }

      if (tableIds.length > 0) {
        const existingTables = await tx.table.findMany({
          where: {
            id: {
              in: tableIds,
            },
          },
          select: {
            id: true,
          },
        });

        if (existingTables.length !== tableIds.length) {
          throw new Error("TABLE_NOT_FOUND");
        }
      }

      await tx.table.updateMany({
        where: {
          assignedWaiterId: waiterId,
          ...(tableIds.length > 0
            ? {
                id: {
                  notIn: tableIds,
                },
              }
            : {}),
        },
        data: {
          assignedWaiterId: null,
        },
      });

      if (tableIds.length > 0) {
        await tx.table.updateMany({
          where: {
            id: {
              in: tableIds,
            },
          },
          data: {
            assignedWaiterId: waiterId,
          },
        });
      }

      return tx.table.findMany({
        where: {
          assignedWaiterId: waiterId,
        },
        include: tableInclude,
        orderBy: {
          number: "asc",
        },
      });
    });

    return sendSuccess(
      res,
      200,
      "Waiter table assignments updated successfully",
      result
    );
  } catch (error) {
    if (error.message === "WAITER_NOT_FOUND") {
      return sendError(res, 404, "Waiter not found");
    }

    if (error.message === "WAITER_ROLE_INVALID") {
      return sendError(res, 400, "Selected user must have waiter role");
    }

    if (error.message === "TABLE_NOT_FOUND") {
      return sendError(res, 404, "One or more tables were not found");
    }

    return handleControllerError(res, error, "Set waiter table assignments error");
  }
};
