const { handleControllerError, sendSuccess } = require("../../utils/response");
const { ensureId } = require("../../utils/validation");
const inventoryLedgerService = require("./inventory-ledger.service");
const {
  parsePageParams,
  validateCreateIngredientPayload,
  validateUpdateIngredientPayload,
  validateRecipePayload,
  validateStockIntakePayload,
} = require("./inventory-ledger.validation");

exports.createIngredient = async (req, res) => {
  try {
    const ingredient = await inventoryLedgerService.createIngredient(
      validateCreateIngredientPayload(req.body),
    );

    return sendSuccess(res, 201, "Ingredient created successfully", ingredient);
  } catch (error) {
    return handleControllerError(res, error, "Create ingredient error");
  }
};

exports.listIngredients = async (req, res) => {
  try {
    const result = await inventoryLedgerService.listIngredients(
      parsePageParams(req.query),
    );

    return sendSuccess(res, 200, "Ingredients retrieved successfully", result);
  } catch (error) {
    return handleControllerError(res, error, "List ingredients error");
  }
};

exports.updateIngredient = async (req, res) => {
  try {
    const id = ensureId(req.params.id, "Ingredient id");
    const payload = validateUpdateIngredientPayload(req.body);
    const ingredient = await inventoryLedgerService.updateIngredient(
      id,
      payload,
    );

    return sendSuccess(res, 200, "Ingredient updated successfully", ingredient);
  } catch (error) {
    return handleControllerError(res, error, "Update ingredient error");
  }
};

exports.deleteIngredient = async (req, res) => {
  try {
    const id = ensureId(req.params.id, "Ingredient id");
    await inventoryLedgerService.deleteIngredient(id);

    return sendSuccess(res, 200, "Ingredient deleted successfully", null);
  } catch (error) {
    return handleControllerError(res, error, "Delete ingredient error");
  }
};

exports.createStockIntake = async (req, res) => {
  try {
    const stockIntake = await inventoryLedgerService.createStockIntake({
      payload: validateStockIntakePayload(req.body),
      actorId: req.user.id,
    });

    return sendSuccess(
      res,
      201,
      "Stock intake created successfully",
      stockIntake,
    );
  } catch (error) {
    return handleControllerError(res, error, "Create stock intake error");
  }
};

exports.listStockIntakes = async (req, res) => {
  try {
    const result = await inventoryLedgerService.listStockIntakes(
      parsePageParams(req.query),
    );

    return sendSuccess(
      res,
      200,
      "Stock intakes retrieved successfully",
      result,
    );
  } catch (error) {
    return handleControllerError(res, error, "List stock intakes error");
  }
};

exports.listStockMovements = async (req, res) => {
  try {
    const pagination = parsePageParams(req.query);
    const ingredientId = req.query.ingredientId
      ? Number(req.query.ingredientId)
      : null;
    const result = await inventoryLedgerService.listStockMovements({
      pagination,
      ingredientId,
    });

    return sendSuccess(
      res,
      200,
      "Stock movements retrieved successfully",
      result,
    );
  } catch (error) {
    return handleControllerError(res, error, "List stock movements error");
  }
};

exports.upsertRecipe = async (req, res) => {
  try {
    const recipe = await inventoryLedgerService.upsertRecipe(
      validateRecipePayload(req.body),
    );

    return sendSuccess(res, 200, "Recipe saved successfully", recipe);
  } catch (error) {
    return handleControllerError(res, error, "Save recipe error");
  }
};

exports.listRecipes = async (req, res) => {
  try {
    const result = await inventoryLedgerService.listRecipes(
      parsePageParams(req.query),
    );

    return sendSuccess(res, 200, "Recipes retrieved successfully", result);
  } catch (error) {
    return handleControllerError(res, error, "List recipes error");
  }
};
