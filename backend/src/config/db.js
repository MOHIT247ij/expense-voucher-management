const { Pool, types } = require('pg');
const { db } = require('./env');

// Return NUMERIC as JS numbers (amounts are NUMERIC(12,2), well within safe range)
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));
// Return DATE columns as plain 'YYYY-MM-DD' strings (avoids timezone shifts)
types.setTypeParser(1082, (val) => val);

const pool = new Pool(
  db.connectionString
    ? { connectionString: db.connectionString, ssl: db.ssl }
    : {
        host: db.host,
        port: db.port,
        database: db.database,
        user: db.user,
        password: db.password,
        ssl: db.ssl,
      }
);

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error', err);
});

/**
 * Run a callback inside a transaction. The callback receives a client.
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  withTransaction,
};
