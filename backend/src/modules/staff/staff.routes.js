const express = require("express");

const authMiddleware = require("../../middlewares/auth.middleware");
const { adminOrManager } = require("../../middlewares/role.middleware");
const staffController = require("./staff.controller");

const router = express.Router();

router.use(authMiddleware);
router.use(adminOrManager);

router.get("/waiters", staffController.getAllWaiters);
router.post("/waiters", staffController.createWaiter);
router.patch("/waiters/:id", staffController.updateWaiter);
router.patch("/waiters/:id/status", staffController.updateWaiterStatus);
router.delete("/waiters/:id", staffController.deleteWaiter);

module.exports = router;
