/**
 * Operational error with an HTTP status code. Anything thrown as AppError is
 * returned to the client as-is; any other error becomes a generic 500.
 */
class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }

  static badRequest(message, details) {
    return new AppError(400, message, details);
  }
  static unauthorized(message = 'Authentication required') {
    return new AppError(401, message);
  }
  static forbidden(message = 'You do not have permission to perform this action') {
    return new AppError(403, message);
  }
  static notFound(message = 'Resource not found') {
    return new AppError(404, message);
  }
  static conflict(message) {
    return new AppError(409, message);
  }
}

module.exports = AppError;
