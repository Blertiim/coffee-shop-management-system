const AppError = require("../../utils/app-error");
const {
  ensureEmail,
  ensureId,
  ensureOptionalString,
  ensurePhone,
  ensureRequiredString,
} = require("../../utils/validation");

const normalizeOptionalEmail = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  return ensureEmail(value, "Supplier email");
};

const validateCreateSupplierPayload = (body) => ({
  contactName: ensureRequiredString(body.contactName, "Supplier contact name"),
  companyName: ensureRequiredString(body.companyName, "Supplier company name"),
  phone: ensurePhone(body.phone, "Supplier phone"),
  email: normalizeOptionalEmail(body.email),
  address: ensureOptionalString(body.address, "Supplier address"),
  productType: ensureOptionalString(body.productType, "Supplier product type"),
});

const validateUpdateSupplierPayload = (body) => {
  const data = {};

  if (body.contactName !== undefined) {
    data.contactName = ensureRequiredString(
      body.contactName,
      "Supplier contact name"
    );
  }

  if (body.companyName !== undefined) {
    data.companyName = ensureRequiredString(
      body.companyName,
      "Supplier company name"
    );
  }

  if (body.phone !== undefined) {
    data.phone = ensurePhone(body.phone, "Supplier phone");
  }

  if (body.email !== undefined) {
    data.email = normalizeOptionalEmail(body.email);
  }

  if (body.address !== undefined) {
    data.address = ensureOptionalString(body.address, "Supplier address");
  }

  if (body.productType !== undefined) {
    data.productType = ensureOptionalString(
      body.productType,
      "Supplier product type"
    );
  }

  if (Object.keys(data).length === 0) {
    throw new AppError("At least one field is required to update the supplier");
  }

  return data;
};

const validateSupplierId = (value) => ensureId(value, "Supplier id");

module.exports = {
  validateCreateSupplierPayload,
  validateUpdateSupplierPayload,
  validateSupplierId,
};
