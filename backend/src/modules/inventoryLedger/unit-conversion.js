const AppError = require("../../utils/app-error");

const UNIT_DEFINITIONS = {
  g: { family: "mass", toBase: 1 },
  kg: { family: "mass", toBase: 1000 },
  ml: { family: "volume", toBase: 1 },
  l: { family: "volume", toBase: 1000 },
  pcs: { family: "piece", toBase: 1 },
};

const BASE_UNITS = new Set(["g", "ml", "pcs"]);

const normalizeUnit = (unit) => {
  const normalized = String(unit || "")
    .trim()
    .toLowerCase();

  if (normalized === "liter" || normalized === "liters" || normalized === "litra") {
    return "l";
  }

  if (normalized === "gram" || normalized === "grams") {
    return "g";
  }

  if (normalized === "kilogram" || normalized === "kilograms") {
    return "kg";
  }

  if (
    normalized === "piece" ||
    normalized === "pieces" ||
    normalized === "pc" ||
    normalized === "pcs" ||
    normalized === "cope"
  ) {
    return "pcs";
  }

  return normalized;
};

const assertKnownUnit = (unit, fieldName = "Unit") => {
  const normalized = normalizeUnit(unit);

  if (!UNIT_DEFINITIONS[normalized]) {
    throw new AppError(`${fieldName} must be one of: g, kg, ml, l, pcs`);
  }

  return normalized;
};

const assertBaseUnit = (unit, fieldName = "Base unit") => {
  const normalized = assertKnownUnit(unit, fieldName);

  if (!BASE_UNITS.has(normalized)) {
    throw new AppError(`${fieldName} must be stored as one of: g, ml, pcs`);
  }

  return normalized;
};

const assertCompatibleUnits = (fromUnit, toUnit) => {
  const from = UNIT_DEFINITIONS[assertKnownUnit(fromUnit, "From unit")];
  const to = UNIT_DEFINITIONS[assertKnownUnit(toUnit, "To unit")];

  if (from.family !== to.family) {
    throw new AppError(`Cannot convert ${fromUnit} to ${toUnit}`);
  }
};

const convertToBaseQuantity = (quantity, fromUnit, baseUnit) => {
  const normalizedFromUnit = assertKnownUnit(fromUnit, "Purchased unit");
  const normalizedBaseUnit = assertBaseUnit(baseUnit, "Base unit");
  assertCompatibleUnits(normalizedFromUnit, normalizedBaseUnit);

  const from = UNIT_DEFINITIONS[normalizedFromUnit];
  const to = UNIT_DEFINITIONS[normalizedBaseUnit];

  return Number(((Number(quantity) * from.toBase) / to.toBase).toFixed(3));
};

module.exports = {
  assertBaseUnit,
  assertCompatibleUnits,
  assertKnownUnit,
  convertToBaseQuantity,
  normalizeUnit,
};
