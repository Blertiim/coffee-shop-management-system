const AppError = require("../../utils/app-error");
const {
  ensureDateTime,
  ensureEmail,
  ensureEnumValue,
  ensureId,
  ensurePhone,
  ensurePositiveNumber,
  ensureRequiredString,
} = require("../../utils/validation");

const VALID_EMPLOYEE_POSITIONS = ["waiter", "manager", "cashier"];

const validateCreateEmployeePayload = (body) => ({
  firstName: ensureRequiredString(body.firstName, "First name"),
  lastName: ensureRequiredString(body.lastName, "Last name"),
  position: ensureEnumValue(
    body.position,
    "Employee position",
    VALID_EMPLOYEE_POSITIONS
  ),
  phone: ensurePhone(body.phone, "Phone"),
  email: ensureEmail(body.email, "Email"),
  hireDate: ensureDateTime(body.hireDate, "Hire date"),
  salary: ensurePositiveNumber(body.salary, "Salary"),
  shift: ensureRequiredString(body.shift, "Shift"),
});

const validateUpdateEmployeePayload = (body) => {
  const data = {};

  if (body.firstName !== undefined) {
    data.firstName = ensureRequiredString(body.firstName, "First name");
  }

  if (body.lastName !== undefined) {
    data.lastName = ensureRequiredString(body.lastName, "Last name");
  }

  if (body.position !== undefined) {
    data.position = ensureEnumValue(
      body.position,
      "Employee position",
      VALID_EMPLOYEE_POSITIONS
    );
  }

  if (body.phone !== undefined) {
    data.phone = ensurePhone(body.phone, "Phone");
  }

  if (body.email !== undefined) {
    data.email = ensureEmail(body.email, "Email");
  }

  if (body.hireDate !== undefined) {
    data.hireDate = ensureDateTime(body.hireDate, "Hire date");
  }

  if (body.salary !== undefined) {
    data.salary = ensurePositiveNumber(body.salary, "Salary");
  }

  if (body.shift !== undefined) {
    data.shift = ensureRequiredString(body.shift, "Shift");
  }

  if (Object.keys(data).length === 0) {
    throw new AppError("At least one field is required to update the employee");
  }

  return data;
};

const validateEmployeeId = (value) => ensureId(value, "Employee id");

module.exports = {
  VALID_EMPLOYEE_POSITIONS,
  validateCreateEmployeePayload,
  validateUpdateEmployeePayload,
  validateEmployeeId,
};
