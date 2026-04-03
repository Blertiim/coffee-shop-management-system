const AppError = require("./app-error");

const sendSuccess = (res, statusCode, message, data = null) =>
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });

const sendError = (res, statusCode, message, data = null) =>
  res.status(statusCode).json({
    success: false,
    message,
    data,
  });

const handleControllerError = (res, error, context) => {
  if (error instanceof AppError) {
    return sendError(res, error.statusCode, error.message, error.data);
  }

  console.error(`${context}:`, error);
  return sendError(res, 500, "Server error");
};

module.exports = {
  sendSuccess,
  sendError,
  handleControllerError,
};
