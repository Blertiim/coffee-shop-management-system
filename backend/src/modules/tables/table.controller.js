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

const ARCHIVED_TABLE_STATUS = "archived";
const ACTIVE_ORDER_STATUSES = ["pending", "preparing", "served", "pending_payment"];
const GUEST_USER_EMAIL = "guest.orders@system.local";

const tableInclude = {
  assignedWaiter: {
    select: {
      id: true,
      fullName: true,
      role: true,
      status: true,
    },
  },
  orders: {
    where: {
      status: {
        in: ACTIVE_ORDER_STATUSES,
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 1,
    select: {
      id: true,
      total: true,
      status: true,
      paymentMethod: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      },
      items: {
        select: {
          quantity: true,
        },
      },
    },
  },
};

const isGuestOriginOrder = (order) => {
  if (!order) {
    return false;
  }

  return (
    normalizeRole(order.user?.role) === "guest" ||
    String(order.user?.email || "").trim().toLowerCase() === GUEST_USER_EMAIL ||
    String(order.paymentMethod || "").trim().toLowerCase() === "guest_qr"
  );
};

const mapTable = (table) => {
  const activeOrder = Array.isArray(table?.orders) ? table.orders[0] : null;
  const itemCount = Array.isArray(activeOrder?.items)
    ? activeOrder.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    : 0;

  return {
    ...table,
    activeGuestOrder: isGuestOriginOrder(activeOrder)
      ? {
          orderId: activeOrder.id,
          total: Number(activeOrder.total || 0),
          status: activeOrder.status,
          itemCount,
          createdAt: activeOrder.createdAt,
          updatedAt: activeOrder.updatedAt,
        }
      : null,
    orders: undefined,
  };
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

    let where = {
      status: {
        not: ARCHIVED_TABLE_STATUS,
      },
    };

    if (userRole === "waiter") {
      if (!userId) {
        return sendSuccess(res, 200, "Tables retrieved successfully", []);
      }

      where = {
        assignedWaiterId: userId,
        status: {
          not: ARCHIVED_TABLE_STATUS,
        },
      };
    }

    const tables = await prisma.table.findMany({
      where,
      include: tableInclude,
      orderBy: { number: "asc" },
    });

    return sendSuccess(
      res,
      200,
      "Tables retrieved successfully",
      tables.map(mapTable)
    );
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

    if (!table || table.status === ARCHIVED_TABLE_STATUS) {
      return sendError(res, 404, "Table not found");
    }

    return sendSuccess(res, 200, "Table retrieved successfully", mapTable(table));
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

    if (!existingTable || existingTable.status === ARCHIVED_TABLE_STATUS) {
      return res.status(404).json({
        success: false,
        message: "Table not found",
        data: null,
      });
    }

    const relationSummary = await prisma.$transaction(async (tx) => {
      const [orderCount, reservationCount] = await Promise.all([
        tx.order.count({
          where: {
            tableId: id,
          },
        }),
        tx.reservation.count({
          where: {
            tableId: id,
          },
        }),
      ]);

      if (orderCount === 0 && reservationCount === 0) {
        await tx.table.delete({
          where: { id },
        });

        return {
          archived: false,
        };
      }

      await tx.tableAccessToken.updateMany({
        where: {
          tableId: id,
        },
        data: {
          status: "revoked",
        },
      });

      await tx.table.update({
        where: { id },
        data: {
          status: ARCHIVED_TABLE_STATUS,
          assignedWaiterId: null,
        },
      });

      return {
        archived: true,
      };
    });

    return sendSuccess(
      res,
      200,
      relationSummary.archived
        ? "Table archived successfully"
        : "Table deleted successfully",
      relationSummary
    );
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
