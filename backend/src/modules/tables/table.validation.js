const AppError = require("../../utils/app-error");
const {
  ensureEnumValue,
  ensureId,
  ensurePositiveInteger,
  ensureRequiredString,
} = require("../../utils/validation");

const VALID_TABLE_STATUSES = ["available", "occupied", "reserved"];

const validateCreateTablePayload = (body) => ({
  number: ensurePositiveInteger(body.number, "Table number"),
  capacity: ensurePositiveInteger(body.capacity, "Table capacity"),
  location: ensureRequiredString(body.location, "Table location"),
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

  if (Object.keys(data).length === 0) {
    throw new AppError("At least one field is required to update the table");
  }

  return data;
};

const validateTableId = (value) => ensureId(value, "Table id");

module.exports = {
  VALID_TABLE_STATUSES,
  validateCreateTablePayload,
  validateUpdateTablePayload,
  validateTableId,
};
