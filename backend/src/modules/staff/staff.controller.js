const { Prisma } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = require("../../config/prisma");
const { publishRealtimeEvent } = require("../../services/realtime.service");
const {
  handleControllerError,
  sendError,
  sendSuccess,
} = require("../../utils/response");
const {
  clearPosLoginAttemptState,
} = require("../../services/pos-login-guard.service");
const {
  validateCreateWaiterPayload,
  validateUpdateWaiterPayload,
  validateUpdateWaiterStatusPayload,
  validateWaiterId,
} = require("./staff.validation");

const WAITER_ROLE = "waiter";
const ARCHIVED_WAITER_STATUS = "archived";

const mapWaiter = (waiter) => ({
  id: waiter.id,
  fullName: waiter.fullName,
  role: waiter.role,
  status: waiter.status,
  email: waiter.email,
  createdAt: waiter.createdAt,
  updatedAt: waiter.updatedAt,
});

const toEmailSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "") || "waiter";

const generateWaiterEmail = (fullName) =>
  `${toEmailSlug(fullName)}.${Date.now().toString(36)}.${Math.floor(
    Math.random() * 10000
  )
    .toString()
    .padStart(4, "0")}@pos.local`;

const findWaiterById = (id) =>
  prisma.user.findFirst({
    where: {
      id,
      role: WAITER_ROLE,
    },
  });

exports.getAllWaiters = async (req, res) => {
  try {
    const waiters = await prisma.user.findMany({
      where: {
        role: WAITER_ROLE,
        status: {
          not: ARCHIVED_WAITER_STATUS,
        },
      },
      orderBy: [{ status: "asc" }, { fullName: "asc" }],
    });

    return sendSuccess(
      res,
      200,
      "Waiters retrieved successfully",
      waiters.map(mapWaiter)
    );
  } catch (error) {
    return handleControllerError(res, error, "Get waiters error");
  }
};

exports.createWaiter = async (req, res) => {
  try {
    const { fullName, pin } = validateCreateWaiterPayload(req.body);
    const hashedPin = await bcrypt.hash(pin, 10);

    let waiter = null;
    let attempts = 0;

    while (!waiter && attempts < 5) {
      attempts += 1;

      try {
        waiter = await prisma.user.create({
          data: {
            fullName,
            email: generateWaiterEmail(fullName),
            password: hashedPin,
            role: WAITER_ROLE,
            status: "active",
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          continue;
        }

        throw error;
      }
    }

    if (!waiter) {
      return sendError(res, 500, "Failed to generate unique waiter account");
    }

    return sendSuccess(res, 201, "Waiter created successfully", mapWaiter(waiter));
  } catch (error) {
    return handleControllerError(res, error, "Create waiter error");
  }
};

exports.updateWaiter = async (req, res) => {
  try {
    const id = validateWaiterId(req.params.id);
    const payload = validateUpdateWaiterPayload(req.body);
    const waiter = await findWaiterById(id);

    if (!waiter) {
      return sendError(res, 404, "Waiter not found");
    }

    const data = {};

    if (payload.fullName !== undefined) {
      data.fullName = payload.fullName;
    }

    if (payload.pin !== undefined) {
      data.password = await bcrypt.hash(payload.pin, 10);
    }

    if (payload.status !== undefined) {
      data.status = payload.status;
    }

    const updatedWaiter = await prisma.user.update({
      where: { id: waiter.id },
      data,
    });

    if (payload.pin !== undefined || payload.status !== undefined) {
      clearPosLoginAttemptState({ identifier: `user:${updatedWaiter.id}` });
    }

    return sendSuccess(
      res,
      200,
      "Waiter updated successfully",
      mapWaiter(updatedWaiter)
    );
  } catch (error) {
    return handleControllerError(res, error, "Update waiter error");
  }
};

exports.updateWaiterStatus = async (req, res) => {
  try {
    const id = validateWaiterId(req.params.id);
    const { status } = validateUpdateWaiterStatusPayload(req.body);
    const waiter = await findWaiterById(id);

    if (!waiter) {
      return sendError(res, 404, "Waiter not found");
    }

    const updatedWaiter = await prisma.user.update({
      where: { id: waiter.id },
      data: { status },
    });

    clearPosLoginAttemptState({ identifier: `user:${updatedWaiter.id}` });

    return sendSuccess(
      res,
      200,
      "Waiter status updated successfully",
      mapWaiter(updatedWaiter)
    );
  } catch (error) {
    return handleControllerError(res, error, "Update waiter status error");
  }
};

exports.deleteWaiter = async (req, res) => {
  try {
    const id = validateWaiterId(req.params.id);
    const waiter = await findWaiterById(id);

    if (!waiter) {
      return sendError(res, 404, "Waiter not found");
    }

    const deletionSummary = await prisma.$transaction(async (tx) => {
      const [assignedTables, relatedOrders] = await Promise.all([
        tx.table.findMany({
          where: {
            assignedWaiterId: waiter.id,
          },
          select: {
            id: true,
            number: true,
          },
        }),
        tx.order.count({
          where: {
            userId: waiter.id,
          },
        }),
      ]);

      if (assignedTables.length > 0) {
        await tx.table.updateMany({
          where: {
            assignedWaiterId: waiter.id,
          },
          data: {
            assignedWaiterId: null,
          },
        });
      }

      let archived = false;

      if (relatedOrders > 0) {
        archived = true;
        await tx.user.update({
          where: {
            id: waiter.id,
          },
          data: {
            status: ARCHIVED_WAITER_STATUS,
          },
        });
      } else {
        await tx.user.delete({
          where: {
            id: waiter.id,
          },
        });
      }

      return {
        archived,
        relatedOrders,
        unassignedTableIds: assignedTables.map((table) => table.id),
        unassignedTableNumbers: assignedTables.map((table) => table.number),
      };
    });

    clearPosLoginAttemptState({ identifier: `user:${waiter.id}` });
    publishRealtimeEvent(["staff", "tables", "dashboard"], {
      type: "resource.changed",
      method: "DELETE",
      route: `/api/staff/waiters/${waiter.id}`,
      statusCode: 200,
      waiterId: waiter.id,
      archived: deletionSummary.archived,
      unassignedTableIds: deletionSummary.unassignedTableIds,
    });

    return sendSuccess(
      res,
      200,
      deletionSummary.archived
        ? "Waiter archived successfully"
        : "Waiter deleted successfully",
      deletionSummary
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return sendError(
        res,
        400,
        "Cannot delete waiter because related records are still linked."
      );
    }

    return handleControllerError(res, error, "Delete waiter error");
  }
};
