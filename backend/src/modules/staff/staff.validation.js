const AppError = require("../../utils/app-error");
const {
  ensureEnumValue,
  ensureId,
  ensureRequiredString,
} = require("../../utils/validation");

const VALID_STATUSES = ["active", "inactive"];

const normalizePin = (value) => {
  if (typeof value !== "string") {
    throw new AppError("PIN is required");
  }

  const pin = value.trim();

  if (!/^\d{4,8}$/.test(pin)) {
    throw new AppError("PIN must contain only digits (4 to 8)");
  }

  return pin;
};

const validateCreateWaiterPayload = (body) => ({
  fullName: ensureRequiredString(body.fullName ?? body.name, "Waiter name"),
  pin: normalizePin(body.pin),
});

const validateWaiterId = (value) => ensureId(value, "Waiter id");

const validateUpdateWaiterPayload = (body) => {
  const payload = {};

  if (body.fullName !== undefined || body.name !== undefined) {
    payload.fullName = ensureRequiredString(
      body.fullName ?? body.name,
      "Waiter name"
    );
  }

  if (body.pin !== undefined) {
    payload.pin = normalizePin(body.pin);
  }

  if (body.status !== undefined) {
    payload.status = ensureEnumValue(body.status, "Waiter status", VALID_STATUSES);
  }

  if (Object.keys(payload).length === 0) {
    throw new AppError("Provide at least one field: name, PIN, or status");
  }

  return payload;
};

const validateUpdateWaiterStatusPayload = (body) => ({
  status: ensureEnumValue(body.status, "Waiter status", VALID_STATUSES),
});

module.exports = {
  VALID_STATUSES,
  validateCreateWaiterPayload,
  validateWaiterId,
  validateUpdateWaiterPayload,
  validateUpdateWaiterStatusPayload,
};
