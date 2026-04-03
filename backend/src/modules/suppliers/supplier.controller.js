const { Prisma } = require("@prisma/client");

const prisma = require("../../config/prisma");
const {
  handleControllerError,
  sendError,
  sendSuccess,
} = require("../../utils/response");
const {
  validateCreateSupplierPayload,
  validateSupplierId,
  validateUpdateSupplierPayload,
} = require("./supplier.validation");

exports.getAllSuppliers = async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      include: {
        _count: {
          select: {
            inventories: true,
            supplierOrders: true,
          },
        },
      },
      orderBy: [{ companyName: "asc" }, { contactName: "asc" }],
    });

    return sendSuccess(res, 200, "Suppliers retrieved successfully", suppliers);
  } catch (error) {
    return handleControllerError(res, error, "Get all suppliers error");
  }
};

exports.getSupplierById = async (req, res) => {
  try {
    const id = validateSupplierId(req.params.id);

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        inventories: {
          orderBy: { itemName: "asc" },
        },
        supplierOrders: {
          include: {
            employee: true,
          },
          orderBy: { orderDate: "desc" },
        },
      },
    });

    if (!supplier) {
      return sendError(res, 404, "Supplier not found");
    }

    return sendSuccess(res, 200, "Supplier retrieved successfully", supplier);
  } catch (error) {
    return handleControllerError(res, error, "Get supplier by id error");
  }
};

exports.createSupplier = async (req, res) => {
  try {
    const data = validateCreateSupplierPayload(req.body);

    const supplier = await prisma.supplier.create({
      data,
    });

    return sendSuccess(res, 201, "Supplier created successfully", supplier);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return sendError(res, 409, "Supplier email already exists");
    }

    return handleControllerError(res, error, "Create supplier error");
  }
};

exports.updateSupplier = async (req, res) => {
  try {
    const id = validateSupplierId(req.params.id);
    const data = validateUpdateSupplierPayload(req.body);

    const existingSupplier = await prisma.supplier.findUnique({
      where: { id },
    });

    if (!existingSupplier) {
      return sendError(res, 404, "Supplier not found");
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data,
    });

    return sendSuccess(res, 200, "Supplier updated successfully", supplier);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return sendError(res, 409, "Supplier email already exists");
    }

    return handleControllerError(res, error, "Update supplier error");
  }
};

exports.deleteSupplier = async (req, res) => {
  try {
    const id = validateSupplierId(req.params.id);

    const existingSupplier = await prisma.supplier.findUnique({
      where: { id },
    });

    if (!existingSupplier) {
      return sendError(res, 404, "Supplier not found");
    }

    await prisma.supplier.delete({
      where: { id },
    });

    return sendSuccess(res, 200, "Supplier deleted successfully", null);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return sendError(
        res,
        400,
        "Cannot delete supplier linked to inventory or supplier orders"
      );
    }

    return handleControllerError(res, error, "Delete supplier error");
  }
};
