const express = require("express");

const authMiddleware = require("../../middlewares/auth.middleware");
const { adminOrManager } = require("../../middlewares/role.middleware");
const inventoryLedgerController = require("./inventory-ledger.controller");

const router = express.Router();

router.use(authMiddleware, adminOrManager);

router.get("/ingredients", inventoryLedgerController.listIngredients);
router.post("/ingredients", inventoryLedgerController.createIngredient);
router.get("/recipes", inventoryLedgerController.listRecipes);
router.put("/recipes", inventoryLedgerController.upsertRecipe);
router.get("/stock-intakes", inventoryLedgerController.listStockIntakes);
router.post("/stock-intakes", inventoryLedgerController.createStockIntake);
router.get("/stock-movements", inventoryLedgerController.listStockMovements);

module.exports = router;
