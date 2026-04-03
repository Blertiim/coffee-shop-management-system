const express = require("express");

const authMiddleware = require("../../middlewares/auth.middleware");
const { adminOnly } = require("../../middlewares/role.middleware");
const shiftController = require("./shift.controller");

const router = express.Router();

router.use(authMiddleware);
router.use(adminOnly);

router.get("/", shiftController.getAllShifts);
router.get("/:id", shiftController.getShiftById);
router.post("/", shiftController.createShift);
router.put("/:id", shiftController.updateShift);
router.delete("/:id", shiftController.deleteShift);

module.exports = router;
