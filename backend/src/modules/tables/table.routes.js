const express = require("express");

const authMiddleware = require("../../middlewares/auth.middleware");
const { adminOnly } = require("../../middlewares/role.middleware");
const tableController = require("./table.controller");

const router = express.Router();

router.use(authMiddleware);

router.get("/", tableController.getAllTables);
router.get("/:id", tableController.getTableById);
router.post("/", adminOnly, tableController.createTable);
router.put("/:id", adminOnly, tableController.updateTable);
router.delete("/:id", adminOnly, tableController.deleteTable);

module.exports = router;
