const express = require("express");

const authMiddleware = require("../../middlewares/auth.middleware");
const { adminOrWaiter } = require("../../middlewares/role.middleware");
const reservationController = require("./reservation.controller");

const router = express.Router();

router.use(authMiddleware);
router.use(adminOrWaiter);

router.get("/", reservationController.getAllReservations);
router.get("/:id", reservationController.getReservationById);
router.post("/", reservationController.createReservation);
router.put("/:id", reservationController.updateReservation);
router.delete("/:id", reservationController.deleteReservation);

module.exports = router;
