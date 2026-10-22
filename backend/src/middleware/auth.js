const jwt = require('jsonwebtoken');
const { jwt: jwtConfig } = require('../config/env');
const db = require('../config/db');
const AppError = require('../utils/AppError');

/**
 * Verifies the Bearer token and attaches the *current* user record to req.user.
 * The user is re-loaded from the database so deactivated users or changed roles
 * take effect immediately.
 */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw AppError.unauthorized();

    let payload;
    try {
      payload = jwt.verify(token, jwtConfig.secret);
    } catch (err) {
      throw AppError.unauthorized(
        err.name === 'TokenExpiredError' ? 'Session expired, please log in again' : 'Invalid token'
      );
    }

    const { rows } = await db.query(
      `SELECT id, name, email, role, employee_code, department, signature_id, is_active
         FROM users WHERE id = $1`,
      [payload.sub]
    );
    const user = rows[0];
    if (!user || !user.is_active) throw AppError.unauthorized('Account not found or inactive');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Role guard: authorize('DIRECTOR') or authorize('DIRECTOR', 'ACCOUNTS') */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden());
    next();
  };
}

module.exports = { authenticate, authorize };
