const {
  consumeIngredientsForOrderItems,
  restoreIngredientsForOrderItems,
} = require("./inventory-engine.service");
const {
  createIngredient,
  listIngredients,
} = require("./ingredient.service");
const {
  listRecipes,
  upsertRecipe,
} = require("./recipe.service");
const {
  createStockIntake,
  listStockIntakes,
} = require("./stock-intake.service");
const { listStockMovements } = require("./stock-movement.service");

module.exports = {
  consumeIngredientsForOrderItems,
  createIngredient,
  createStockIntake,
  listIngredients,
  listRecipes,
  listStockIntakes,
  listStockMovements,
  restoreIngredientsForOrderItems,
  upsertRecipe,
};
