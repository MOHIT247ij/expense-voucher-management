const multer = require('multer');
const AppError = require('../utils/AppError');
const { nodeEnv, upload } = require('../config/env');

function notFound(req, res, next) {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = 500;
  let message = 'Something went wrong. Please try again later.';
  let details;

  if (err instanceof AppError) {
    status = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err instanceof multer.MulterError) {
    status = 400;
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `File too large. Maximum size is ${Math.round(upload.maxFileSizeBytes / 1024 / 1024)} MB`
        : `Upload error: ${err.message}`;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON in request body';
  } else if (err.code === '23505') {
    status = 409;
    message = 'A record with the same unique value already exists';
  } else if (err.code === '23514' || err.code === '22P02' || err.code === '22007' || err.code === '22008') {
    // check constraint / invalid input syntax / invalid date
    status = 400;
    message = 'Invalid data supplied';
  }

  if (status >= 500) console.error(err);

  res.status(status).json({
    success: false,
    message,
    ...(details && { errors: details }),
    ...(nodeEnv === 'development' && status >= 500 && { stack: err.stack }),
  });
}

module.exports = { notFound, errorHandler };
