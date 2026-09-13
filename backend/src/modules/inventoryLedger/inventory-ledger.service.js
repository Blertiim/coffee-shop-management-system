const {
  consumeIngredientsForOrderItems,
  restoreIngredientsForOrderItems,
} = require("./inventory-engine.service");
const {
  createIngredient,
  listIngredients,
  updateIngredient,
  deleteIngredient,
} = require("./ingredient.service");
const { listRecipes, upsertRecipe } = require("./recipe.service");
const {
  createStockIntake,
  listStockIntakes,
} = require("./stock-intake.service");
const { listStockMovements } = require("./stock-movement.service");

module.exports = {
  consumeIngredientsForOrderItems,
  createIngredient,
  createStockIntake,
  deleteIngredient,
  listIngredients,
  listRecipes,
  listStockIntakes,
  listStockMovements,
  restoreIngredientsForOrderItems,
  updateIngredient,
  upsertRecipe,
};
