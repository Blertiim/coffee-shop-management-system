const AppError = require("../../utils/app-error");
const {
  ensureEnumValue,
  ensureId,
  ensurePositiveInteger,
  ensureRequiredString,
} = require("../../utils/validation");

const VALID_TABLE_STATUSES = [
  "available",
  "occupied",
  "reserved",
  "pending_payment",
  "paid",
];

const validateCreateTablePayload = (body) => ({
  number: ensurePositiveInteger(body.number, "Table number"),
  capacity: ensurePositiveInteger(body.capacity, "Table capacity"),
  location: ensureRequiredString(body.location, "Table location"),
  assignedWaiterId:
    body.assignedWaiterId === undefined || body.assignedWaiterId === null
      ? null
      : ensureId(body.assignedWaiterId, "Assigned waiter id"),
  status:
    body.status === undefined
      ? "available"
      : ensureEnumValue(body.status, "Table status", VALID_TABLE_STATUSES),
});

const validateUpdateTablePayload = (body) => {
  const data = {};

  if (body.number !== undefined) {
    data.number = ensurePositiveInteger(body.number, "Table number");
  }

  if (body.capacity !== undefined) {
    data.capacity = ensurePositiveInteger(body.capacity, "Table capacity");
  }

  if (body.location !== undefined) {
    data.location = ensureRequiredString(body.location, "Table location");
  }

  if (body.status !== undefined) {
    data.status = ensureEnumValue(
      body.status,
      "Table status",
      VALID_TABLE_STATUSES
    );
  }

  if (body.assignedWaiterId !== undefined) {
    data.assignedWaiterId =
      body.assignedWaiterId === null
        ? null
        : ensureId(body.assignedWaiterId, "Assigned waiter id");
  }

  if (Object.keys(data).length === 0) {
    throw new AppError("At least one field is required to update the table");
  }

  return data;
};

const validateAssignTablePayload = (body) => ({
  waiterId:
    body.waiterId === null || body.waiterId === undefined
      ? null
      : ensureId(body.waiterId, "Waiter id"),
});

const validateBulkAssignPayload = (body) => {
  const waiterId = ensureId(body.waiterId, "Waiter id");

  if (!Array.isArray(body.tableIds)) {
    throw new AppError("tableIds must be an array");
  }

  const tableIds = [...new Set(body.tableIds.map((tableId) => ensureId(tableId, "Table id")))];

  return { waiterId, tableIds };
};

const validateTableId = (value) => ensureId(value, "Table id");

module.exports = {
  VALID_TABLE_STATUSES,
  validateCreateTablePayload,
  validateAssignTablePayload,
  validateBulkAssignPayload,
  validateUpdateTablePayload,
  validateTableId,
};
