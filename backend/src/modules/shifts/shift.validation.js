const AppError = require("../../utils/app-error");
const {
  ensureDateOnly,
  ensureId,
  ensureOptionalString,
  ensureTime,
} = require("../../utils/validation");

const ensureStartBeforeEnd = (startTime, endTime) => {
  if (startTime >= endTime) {
    throw new AppError("Shift end time must be after start time");
  }
};

const validateCreateShiftPayload = (body) => {
  const startTime = ensureTime(body.startTime, "Shift start time");
  const endTime = ensureTime(body.endTime, "Shift end time");

  ensureStartBeforeEnd(startTime, endTime);

  return {
    employeeId: ensureId(body.employeeId, "Employee id"),
    date: ensureDateOnly(body.date, "Shift date"),
    startTime,
    endTime,
    notes: ensureOptionalString(body.notes, "Shift notes"),
  };
};

const validateUpdateShiftPayload = (body) => {
  const data = {};

  if (body.employeeId !== undefined) {
    data.employeeId = ensureId(body.employeeId, "Employee id");
  }

  if (body.date !== undefined) {
    data.date = ensureDateOnly(body.date, "Shift date");
  }

  if (body.startTime !== undefined) {
    data.startTime = ensureTime(body.startTime, "Shift start time");
  }

  if (body.endTime !== undefined) {
    data.endTime = ensureTime(body.endTime, "Shift end time");
  }

  if (data.startTime !== undefined && data.endTime !== undefined) {
    ensureStartBeforeEnd(data.startTime, data.endTime);
  }

  if (body.notes !== undefined) {
    data.notes = ensureOptionalString(body.notes, "Shift notes");
  }

  if (Object.keys(data).length === 0) {
    throw new AppError("At least one field is required to update the shift");
  }

  return data;
};

const validateShiftId = (value) => ensureId(value, "Shift id");

module.exports = {
  validateCreateShiftPayload,
  validateUpdateShiftPayload,
  validateShiftId,
};
