const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const { jwt: jwtConfig } = require('../config/env');
const { saveSignature, deleteIfUnused } = require('./signature.service');

function toUserDto(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    employeeCode: u.employee_code,
    department: u.department,
    hasSignature: Boolean(u.signature_id),
  };
}

async function login(email, password) {
  const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  // Same message for unknown email and wrong password (no user enumeration)
  const ok = user && user.is_active && (await bcrypt.compare(password, user.password_hash));
  if (!ok) throw AppError.unauthorized('Invalid email or password');

  const token = jwt.sign({ sub: user.id, role: user.role }, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
  });
  return { token, user: toUserDto(user) };
}

async function saveProfileSignature(user, file) {
  await db.withTransaction(async (client) => {
    const id = await saveSignature(client, file, user.id);
    await client.query('UPDATE users SET signature_id = $1 WHERE id = $2', [id, user.id]);
    // The old image stays if a voucher was signed with it, otherwise it is removed
    await deleteIfUnused(client, user.signature_id);
  });
  return { ...toUserDto(user), hasSignature: true };
}

module.exports = { login, toUserDto, saveProfileSignature };
