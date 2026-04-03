const express = require("express");

const authMiddleware = require("../../middlewares/auth.middleware");
const { adminOrManager } = require("../../middlewares/role.middleware");
const tableController = require("./table.controller");

const router = express.Router();

router.use(authMiddleware);

router.get("/", tableController.getAllTables);
router.get("/:id", tableController.getTableById);
router.post("/", adminOrManager, tableController.createTable);
router.put("/:id", adminOrManager, tableController.updateTable);
router.patch("/:id/assignment", adminOrManager, tableController.assignTableToWaiter);
router.put(
  "/assignments/waiter",
  adminOrManager,
  tableController.setWaiterTableAssignments
);
router.delete("/:id", adminOrManager, tableController.deleteTable);

module.exports = router;
