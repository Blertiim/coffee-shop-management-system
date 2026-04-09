const express = require("express");

const authMiddleware = require("../../middlewares/auth.middleware");
const { adminOrManager } = require("../../middlewares/role.middleware");
const guestController = require("./guest.controller");

const router = express.Router();

router.get(
  "/tables/:tableId/access",
  authMiddleware,
  adminOrManager,
  guestController.getTableGuestAccess
);
router.post(
  "/tables/:tableId/access/rotate",
  authMiddleware,
  adminOrManager,
  guestController.rotateTableGuestAccess
);
router.get("/access/:token/menu", guestController.getGuestMenu);
router.post("/access/:token/order", guestController.submitGuestOrder);

module.exports = router;
