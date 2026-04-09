const AppError = require("../utils/app-error");
const { sendError } = require("../utils/response");

const notFoundHandler = (req, res) =>
  sendError(res, 404, `Route not found: ${req.originalUrl}`);

const globalErrorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof AppError) {
    return sendError(res, error.statusCode, error.message, error.data);
  }

  if (error?.type === "entity.parse.failed") {
    return sendError(res, 400, "Invalid JSON payload");
  }

  if (error?.message === "Not allowed by CORS") {
    return sendError(res, 403, "Origin is not allowed by CORS");
  }

  console.error("Unhandled application error:", error);
  return sendError(res, 500, "Server error");
};

module.exports = {
  globalErrorHandler,
  notFoundHandler,
};
