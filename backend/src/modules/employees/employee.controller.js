const { Prisma } = require("@prisma/client");

const prisma = require("../../config/prisma");
const { handleControllerError, sendSuccess } = require("../../utils/response");
const {
  validateCreateEmployeePayload,
  validateEmployeeId,
  validateUpdateEmployeePayload,
} = require("./employee.validation");

exports.getAllEmployees = async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: [{ position: "asc" }, { firstName: "asc" }],
    });

    return sendSuccess(res, 200, "Employees retrieved successfully", employees);
  } catch (error) {
    return handleControllerError(res, error, "Get all employees error");
  }
};

exports.getEmployeeById = async (req, res) => {
  try {
    const id = validateEmployeeId(req.params.id);

    const employee = await prisma.employee.findUnique({
      where: { id },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
        data: null,
      });
    }

    return sendSuccess(res, 200, "Employee retrieved successfully", employee);
  } catch (error) {
    return handleControllerError(res, error, "Get employee by id error");
  }
};

exports.createEmployee = async (req, res) => {
  try {
    const data = validateCreateEmployeePayload(req.body);

    const employee = await prisma.employee.create({
      data,
    });

    return sendSuccess(res, 201, "Employee created successfully", employee);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        message: "Employee email already exists",
        data: null,
      });
    }

    return handleControllerError(res, error, "Create employee error");
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const id = validateEmployeeId(req.params.id);
    const data = validateUpdateEmployeePayload(req.body);

    const existingEmployee = await prisma.employee.findUnique({
      where: { id },
    });

    if (!existingEmployee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
        data: null,
      });
    }

    const employee = await prisma.employee.update({
      where: { id },
      data,
    });

    return sendSuccess(res, 200, "Employee updated successfully", employee);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        message: "Employee email already exists",
        data: null,
      });
    }

    return handleControllerError(res, error, "Update employee error");
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const id = validateEmployeeId(req.params.id);

    const existingEmployee = await prisma.employee.findUnique({
      where: { id },
    });

    if (!existingEmployee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
        data: null,
      });
    }

    await prisma.employee.delete({
      where: { id },
    });

    return sendSuccess(res, 200, "Employee deleted successfully", null);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete an employee linked to existing orders",
        data: null,
      });
    }

    return handleControllerError(res, error, "Delete employee error");
  }
};
