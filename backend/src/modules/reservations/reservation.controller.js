const prisma = require("../../config/prisma");
const AppError = require("../../utils/app-error");
const { handleControllerError, sendSuccess } = require("../../utils/response");
const {
  validateCreateReservationPayload,
  validateReservationId,
  validateUpdateReservationPayload,
} = require("./reservation.validation");

const reservationInclude = {
  table: true,
};

const findReservationConflict = async (tableId, date, time, excludeId = null) => {
  const where = {
    tableId,
    date,
    time,
    status: {
      not: "cancelled",
    },
  };

  if (excludeId) {
    where.id = { not: excludeId };
  }

  return prisma.reservation.findFirst({ where });
};

const ensureTableAvailabilityForReservation = async (
  tableId,
  numberOfPeople,
  date,
  time,
  excludeId = null,
  nextStatus = "pending"
) => {
  const table = await prisma.table.findUnique({
    where: { id: tableId },
  });

  if (!table) {
    throw new AppError("Table not found", 404);
  }

  if (numberOfPeople > table.capacity) {
    throw new AppError("Number of people exceeds table capacity");
  }

  if (nextStatus !== "cancelled") {
    const conflictingReservation = await findReservationConflict(
      tableId,
      date,
      time,
      excludeId
    );

    if (conflictingReservation) {
      throw new AppError("This table is already reserved for the selected date and time");
    }
  }

  return table;
};

exports.getAllReservations = async (req, res) => {
  try {
    const reservations = await prisma.reservation.findMany({
      include: reservationInclude,
      orderBy: [{ date: "asc" }, { time: "asc" }, { createdAt: "desc" }],
    });

    return sendSuccess(
      res,
      200,
      "Reservations retrieved successfully",
      reservations
    );
  } catch (error) {
    return handleControllerError(res, error, "Get all reservations error");
  }
};

exports.getReservationById = async (req, res) => {
  try {
    const id = validateReservationId(req.params.id);

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: reservationInclude,
    });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found",
        data: null,
      });
    }

    return sendSuccess(
      res,
      200,
      "Reservation retrieved successfully",
      reservation
    );
  } catch (error) {
    return handleControllerError(res, error, "Get reservation by id error");
  }
};

exports.createReservation = async (req, res) => {
  try {
    const data = validateCreateReservationPayload(req.body);

    await ensureTableAvailabilityForReservation(
      data.tableId,
      data.numberOfPeople,
      data.date,
      data.time,
      null,
      data.status
    );

    const reservation = await prisma.reservation.create({
      data,
      include: reservationInclude,
    });

    return sendSuccess(
      res,
      201,
      "Reservation created successfully",
      reservation
    );
  } catch (error) {
    return handleControllerError(res, error, "Create reservation error");
  }
};

exports.updateReservation = async (req, res) => {
  try {
    const id = validateReservationId(req.params.id);
    const data = validateUpdateReservationPayload(req.body);

    const existingReservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!existingReservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found",
        data: null,
      });
    }

    const nextReservationState = {
      ...existingReservation,
      ...data,
    };

    await ensureTableAvailabilityForReservation(
      nextReservationState.tableId,
      nextReservationState.numberOfPeople,
      nextReservationState.date,
      nextReservationState.time,
      id,
      nextReservationState.status
    );

    const reservation = await prisma.reservation.update({
      where: { id },
      data,
      include: reservationInclude,
    });

    return sendSuccess(
      res,
      200,
      "Reservation updated successfully",
      reservation
    );
  } catch (error) {
    return handleControllerError(res, error, "Update reservation error");
  }
};

exports.deleteReservation = async (req, res) => {
  try {
    const id = validateReservationId(req.params.id);

    const existingReservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!existingReservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found",
        data: null,
      });
    }

    await prisma.reservation.delete({
      where: { id },
    });

    return sendSuccess(res, 200, "Reservation deleted successfully", null);
  } catch (error) {
    return handleControllerError(res, error, "Delete reservation error");
  }
};
