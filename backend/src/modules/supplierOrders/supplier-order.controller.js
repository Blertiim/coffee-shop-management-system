const prisma = require("../../config/prisma");
const {
  handleControllerError,
  sendError,
  sendSuccess,
} = require("../../utils/response");
const {
  validateCreateSupplierOrderPayload,
  validateSupplierOrderId,
  validateUpdateSupplierOrderPayload,
} = require("./supplier-order.validation");

const supplierOrderInclude = {
  supplier: true,
  employee: true,
};

const ensureSupplierExists = async (supplierId) => {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { id: true },
  });

  return Boolean(supplier);
};

const ensureEmployeeExists = async (employeeId) => {
  if (employeeId === null || employeeId === undefined) {
    return true;
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true },
  });

  return Boolean(employee);
};

exports.getAllSupplierOrders = async (req, res) => {
  try {
    const supplierOrders = await prisma.supplierOrder.findMany({
      include: supplierOrderInclude,
      orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
    });

    return sendSuccess(
      res,
      200,
      "Supplier orders retrieved successfully",
      supplierOrders
    );
  } catch (error) {
    return handleControllerError(res, error, "Get all supplier orders error");
  }
};

exports.getSupplierOrderById = async (req, res) => {
  try {
    const id = validateSupplierOrderId(req.params.id);

    const supplierOrder = await prisma.supplierOrder.findUnique({
      where: { id },
      include: supplierOrderInclude,
    });

    if (!supplierOrder) {
      return sendError(res, 404, "Supplier order not found");
    }

    return sendSuccess(
      res,
      200,
      "Supplier order retrieved successfully",
      supplierOrder
    );
  } catch (error) {
    return handleControllerError(res, error, "Get supplier order by id error");
  }
};

exports.createSupplierOrder = async (req, res) => {
  try {
    const data = validateCreateSupplierOrderPayload(req.body);

    const supplierExists = await ensureSupplierExists(data.supplierId);

    if (!supplierExists) {
      return sendError(res, 404, "Supplier not found");
    }

    const employeeExists = await ensureEmployeeExists(data.employeeId);

    if (!employeeExists) {
      return sendError(res, 404, "Employee not found");
    }

    const supplierOrder = await prisma.supplierOrder.create({
      data,
      include: supplierOrderInclude,
    });

    return sendSuccess(
      res,
      201,
      "Supplier order created successfully",
      supplierOrder
    );
  } catch (error) {
    return handleControllerError(res, error, "Create supplier order error");
  }
};

exports.updateSupplierOrder = async (req, res) => {
  try {
    const id = validateSupplierOrderId(req.params.id);
    const data = validateUpdateSupplierOrderPayload(req.body);

    const existingSupplierOrder = await prisma.supplierOrder.findUnique({
      where: { id },
    });

    if (!existingSupplierOrder) {
      return sendError(res, 404, "Supplier order not found");
    }

    if (data.supplierId !== undefined) {
      const supplierExists = await ensureSupplierExists(data.supplierId);

      if (!supplierExists) {
        return sendError(res, 404, "Supplier not found");
      }
    }

    if (data.employeeId !== undefined) {
      const employeeExists = await ensureEmployeeExists(data.employeeId);

      if (!employeeExists) {
        return sendError(res, 404, "Employee not found");
      }
    }

    const supplierOrder = await prisma.supplierOrder.update({
      where: { id },
      data,
      include: supplierOrderInclude,
    });

    return sendSuccess(
      res,
      200,
      "Supplier order updated successfully",
      supplierOrder
    );
  } catch (error) {
    return handleControllerError(res, error, "Update supplier order error");
  }
};

exports.deleteSupplierOrder = async (req, res) => {
  try {
    const id = validateSupplierOrderId(req.params.id);

    const existingSupplierOrder = await prisma.supplierOrder.findUnique({
      where: { id },
    });

    if (!existingSupplierOrder) {
      return sendError(res, 404, "Supplier order not found");
    }

    await prisma.supplierOrder.delete({
      where: { id },
    });

    return sendSuccess(res, 200, "Supplier order deleted successfully", null);
  } catch (error) {
    return handleControllerError(res, error, "Delete supplier order error");
  }
};
