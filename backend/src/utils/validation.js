const AppError = require("./app-error");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+\d][\d\s\-()]{5,19}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const normalizeString = (value) =>
  typeof value === "string" ? value.trim() : "";

const ensureRequiredString = (value, fieldName) => {
  const normalizedValue = normalizeString(value);

  if (!normalizedValue) {
    throw new AppError(`${fieldName} is required`);
  }

  return normalizedValue;
};

const ensureOptionalString = (value, fieldName) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new AppError(`${fieldName} must be a string`);
  }

  const normalizedValue = value.trim();

  return normalizedValue || null;
};

const ensurePositiveInteger = (value, fieldName) => {
  const numericValue = Number(value);

  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw new AppError(`${fieldName} must be a positive integer`);
  }

  return numericValue;
};

const ensureNonNegativeInteger = (value, fieldName) => {
  const numericValue = Number(value);

  if (!Number.isInteger(numericValue) || numericValue < 0) {
    throw new AppError(
      `${fieldName} must be a whole number greater than or equal to 0`
    );
  }

  return numericValue;
};

const ensurePositiveNumber = (value, fieldName) => {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue) || numericValue <= 0) {
    throw new AppError(`${fieldName} must be a number greater than 0`);
  }

  return numericValue;
};

const ensureNonNegativeNumber = (value, fieldName) => {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue) || numericValue < 0) {
    throw new AppError(`${fieldName} must be a number greater than or equal to 0`);
  }

  return numericValue;
};

const ensureEmail = (value, fieldName = "Email") => {
  const normalizedValue = ensureRequiredString(value, fieldName).toLowerCase();

  if (!EMAIL_REGEX.test(normalizedValue)) {
    throw new AppError(`${fieldName} must be a valid email address`);
  }

  return normalizedValue;
};

const ensurePhone = (value, fieldName = "Phone") => {
  const normalizedValue = ensureRequiredString(value, fieldName);

  if (!PHONE_REGEX.test(normalizedValue)) {
    throw new AppError(`${fieldName} must be a valid phone number`);
  }

  return normalizedValue;
};

const ensureEnumValue = (value, fieldName, allowedValues) => {
  if (typeof value !== "string") {
    throw new AppError(
      `${fieldName} must be one of: ${allowedValues.join(", ")}`
    );
  }

  const normalizedValue = value.trim().toLowerCase();

  if (!allowedValues.includes(normalizedValue)) {
    throw new AppError(
      `${fieldName} must be one of: ${allowedValues.join(", ")}`
    );
  }

  return normalizedValue;
};

const ensureBoolean = (value, fieldName) => {
  if (typeof value !== "boolean") {
    throw new AppError(`${fieldName} must be a boolean value`);
  }

  return value;
};

const ensureId = (value, fieldName = "Id") =>
  ensurePositiveInteger(value, fieldName);

const ensureDateTime = (value, fieldName) => {
  const parsedDate = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new AppError(`${fieldName} must be a valid date`);
  }

  return parsedDate;
};

const ensureDateOnly = (value, fieldName) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw new AppError(`${fieldName} must be in YYYY-MM-DD format`);
  }

  const normalizedValue = value.trim();
  const parsedDate = new Date(`${normalizedValue}T00:00:00.000Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new AppError(`${fieldName} must be a valid date`);
  }

  return parsedDate;
};

const ensureTime = (value, fieldName) => {
  if (typeof value !== "string" || !TIME_REGEX.test(value.trim())) {
    throw new AppError(`${fieldName} must be in HH:MM format`);
  }

  return value.trim();
};

const ensureArray = (value, fieldName) => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError(`${fieldName} are required`);
  }

  return value;
};

module.exports = {
  normalizeString,
  ensureRequiredString,
  ensureOptionalString,
  ensurePositiveInteger,
  ensureNonNegativeInteger,
  ensurePositiveNumber,
  ensureNonNegativeNumber,
  ensureEmail,
  ensurePhone,
  ensureEnumValue,
  ensureBoolean,
  ensureId,
  ensureDateTime,
  ensureDateOnly,
  ensureTime,
  ensureArray,
};
