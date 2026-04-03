const AppError = require("../../utils/app-error");
const {
  ensureDateOnly,
  ensureEnumValue,
  ensureId,
  ensurePhone,
  ensurePositiveInteger,
  ensureRequiredString,
  ensureTime,
} = require("../../utils/validation");

const VALID_RESERVATION_STATUSES = ["pending", "confirmed", "cancelled"];

const validateCreateReservationPayload = (body) => ({
  customerName: ensureRequiredString(body.customerName, "Customer name"),
  phone: ensurePhone(body.phone, "Phone"),
  tableId: ensureId(body.tableId, "Table id"),
  date: ensureDateOnly(body.date, "Reservation date"),
  time: ensureTime(body.time, "Reservation time"),
  numberOfPeople: ensurePositiveInteger(
    body.numberOfPeople,
    "Number of people"
  ),
  status:
    body.status === undefined
      ? "pending"
      : ensureEnumValue(
          body.status,
          "Reservation status",
          VALID_RESERVATION_STATUSES
        ),
});

const validateUpdateReservationPayload = (body) => {
  const data = {};

  if (body.customerName !== undefined) {
    data.customerName = ensureRequiredString(body.customerName, "Customer name");
  }

  if (body.phone !== undefined) {
    data.phone = ensurePhone(body.phone, "Phone");
  }

  if (body.tableId !== undefined) {
    data.tableId = ensureId(body.tableId, "Table id");
  }

  if (body.date !== undefined) {
    data.date = ensureDateOnly(body.date, "Reservation date");
  }

  if (body.time !== undefined) {
    data.time = ensureTime(body.time, "Reservation time");
  }

  if (body.numberOfPeople !== undefined) {
    data.numberOfPeople = ensurePositiveInteger(
      body.numberOfPeople,
      "Number of people"
    );
  }

  if (body.status !== undefined) {
    data.status = ensureEnumValue(
      body.status,
      "Reservation status",
      VALID_RESERVATION_STATUSES
    );
  }

  if (Object.keys(data).length === 0) {
    throw new AppError("At least one field is required to update the reservation");
  }

  return data;
};

const validateReservationId = (value) => ensureId(value, "Reservation id");

module.exports = {
  VALID_RESERVATION_STATUSES,
  validateCreateReservationPayload,
  validateUpdateReservationPayload,
  validateReservationId,
};
