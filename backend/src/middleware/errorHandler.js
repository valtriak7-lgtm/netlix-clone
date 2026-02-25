function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const isValidationError = err.name === 'ValidationError';
  const isCastError = err.name === 'CastError';
  const status = err.status || (isValidationError || isCastError ? 400 : 500);

  if (status === 500) {
    console.error('Server error:', err.message);
  }

  return res.status(status).json({
    message: status === 500 ? 'Internal server error' : err.message,
    details: isValidationError ? Object.values(err.errors).map((entry) => entry.message) : undefined,
  });
}

module.exports = errorHandler;
