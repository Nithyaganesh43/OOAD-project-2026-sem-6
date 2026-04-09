const ApiError = require("../utils/ApiError");

const notFound = (req, _res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

const errorHandler = (error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;

  if (error.name === "ValidationError") {
    return res.status(400).json({
      message: "Validation failed",
      errors: Object.values(error.errors).map((item) => item.message),
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      message: "Duplicate value detected",
      field: Object.keys(error.keyValue || {})[0],
    });
  }

  return res.status(statusCode).json({
    message: error.message || "Something went wrong",
    ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
  });
};

module.exports = {
  notFound,
  errorHandler,
};
