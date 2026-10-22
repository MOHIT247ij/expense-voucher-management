const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const required = ['JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    // Fail fast: running without a JWT secret would make every token forgeable.
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

module.exports = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  // Used for "Approved Today" / "Rejected Today" on the Director dashboard
  timezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
  db: {
    connectionString: process.env.DATABASE_URL || undefined,
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'expense_voucher',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
  upload: {
    maxFileSizeBytes: (Number(process.env.MAX_FILE_SIZE_MB) || 2) * 1024 * 1024,
  },
};
