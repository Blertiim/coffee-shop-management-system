const express = require("express");

const authMiddleware = require("../../middlewares/auth.middleware");
const { adminOnly } = require("../../middlewares/role.middleware");
const inventoryController = require("./inventory.controller");

const router = express.Router();

router.use(authMiddleware);
router.use(adminOnly);

router.get("/", inventoryController.getAllInventory);
router.get("/:id", inventoryController.getInventoryById);
router.post("/", inventoryController.createInventoryItem);
router.put("/:id", inventoryController.updateInventoryItem);
router.delete("/:id", inventoryController.deleteInventoryItem);

module.exports = router;
