const prisma = require("../../config/prisma");
const {
  handleControllerError,
  sendError,
  sendSuccess,
} = require("../../utils/response");
const {
  validateCreateShiftPayload,
  validateShiftId,
  validateUpdateShiftPayload,
} = require("./shift.validation");

const shiftInclude = {
  employee: true,
};

exports.getAllShifts = async (req, res) => {
  try {
    const shifts = await prisma.shift.findMany({
      include: shiftInclude,
      orderBy: [{ date: "desc" }, { startTime: "asc" }],
    });

    return sendSuccess(res, 200, "Shifts retrieved successfully", shifts);
  } catch (error) {
    return handleControllerError(res, error, "Get all shifts error");
  }
};

exports.getShiftById = async (req, res) => {
  try {
    const id = validateShiftId(req.params.id);

    const shift = await prisma.shift.findUnique({
      where: { id },
      include: shiftInclude,
    });

    if (!shift) {
      return sendError(res, 404, "Shift not found");
    }

    return sendSuccess(res, 200, "Shift retrieved successfully", shift);
  } catch (error) {
    return handleControllerError(res, error, "Get shift by id error");
  }
};

exports.createShift = async (req, res) => {
  try {
    const data = validateCreateShiftPayload(req.body);

    const employee = await prisma.employee.findUnique({
      where: { id: data.employeeId },
      select: { id: true },
    });

    if (!employee) {
      return sendError(res, 404, "Employee not found");
    }

    const shift = await prisma.shift.create({
      data,
      include: shiftInclude,
    });

    return sendSuccess(res, 201, "Shift created successfully", shift);
  } catch (error) {
    return handleControllerError(res, error, "Create shift error");
  }
};

exports.updateShift = async (req, res) => {
  try {
    const id = validateShiftId(req.params.id);
    const data = validateUpdateShiftPayload(req.body);

    const existingShift = await prisma.shift.findUnique({
      where: { id },
    });

    if (!existingShift) {
      return sendError(res, 404, "Shift not found");
    }

    if (data.employeeId !== undefined) {
      const employee = await prisma.employee.findUnique({
        where: { id: data.employeeId },
        select: { id: true },
      });

      if (!employee) {
        return sendError(res, 404, "Employee not found");
      }
    }

    if (
      (data.startTime !== undefined || data.endTime !== undefined) &&
      !(data.startTime !== undefined && data.endTime !== undefined)
    ) {
      const nextStartTime =
        data.startTime === undefined ? existingShift.startTime : data.startTime;
      const nextEndTime =
        data.endTime === undefined ? existingShift.endTime : data.endTime;

      if (nextStartTime >= nextEndTime) {
        return sendError(res, 400, "Shift end time must be after start time");
      }
    }

    const shift = await prisma.shift.update({
      where: { id },
      data,
      include: shiftInclude,
    });

    return sendSuccess(res, 200, "Shift updated successfully", shift);
  } catch (error) {
    return handleControllerError(res, error, "Update shift error");
  }
};

exports.deleteShift = async (req, res) => {
  try {
    const id = validateShiftId(req.params.id);

    const existingShift = await prisma.shift.findUnique({
      where: { id },
    });

    if (!existingShift) {
      return sendError(res, 404, "Shift not found");
    }

    await prisma.shift.delete({
      where: { id },
    });

    return sendSuccess(res, 200, "Shift deleted successfully", null);
  } catch (error) {
    return handleControllerError(res, error, "Delete shift error");
  }
};
