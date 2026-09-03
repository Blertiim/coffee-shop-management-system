const { Prisma } = require("@prisma/client");

const prisma = require("../../config/prisma");
const { handleControllerError, sendError, sendSuccess } = require("../../utils/response");
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
      return sendError(res, 404, "Employee not found");
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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return sendError(res, 409, "Employee email already exists");
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
      return sendError(res, 404, "Employee not found");
    }

    const employee = await prisma.employee.update({
      where: { id },
      data,
    });

    return sendSuccess(res, 200, "Employee updated successfully", employee);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return sendError(res, 409, "Employee email already exists");
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
      return sendError(res, 404, "Employee not found");
    }

    await prisma.employee.delete({
      where: { id },
    });

    return sendSuccess(res, 200, "Employee deleted successfully", null);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return sendError(res, 400, "Cannot delete an employee linked to existing orders");
    }

    return handleControllerError(res, error, "Delete employee error");
  }
};
