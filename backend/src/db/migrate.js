/**
 * Minimal migration runner: applies every .sql file in ./migrations
 * (in filename order) that has not been applied yet.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { pool } = require('../config/db');
const { db: dbConfig } = require('../config/env');

/** Creates the database (local setups only) if it does not exist yet. */
async function ensureDatabase() {
  if (dbConfig.connectionString) return; // hosted DB: already provisioned
  const admin = new Client({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: 'postgres',
    ssl: dbConfig.ssl,
  });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbConfig.database]);
    if (!rowCount) {
      if (!/^[A-Za-z0-9_]+$/.test(dbConfig.database)) throw new Error('DB_NAME may only contain letters, digits and _');
      await admin.query(`CREATE DATABASE "${dbConfig.database}"`);
      console.log(`+ created database ${dbConfig.database}`);
    }
  } finally {
    await admin.end();
  }
}

async function migrate() {
  await ensureDatabase();
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  const { rows } = await pool.query('SELECT filename FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.filename));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`- skip   ${file} (already applied)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`+ apply  ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${err.message}`);
    } finally {
      client.release();
    }
  }
}

migrate()
  .then(() => {
    console.log('Migrations complete.');
    return pool.end();
  })
  .catch(async (err) => {
    console.error(err.message);
    await pool.end();
    process.exit(1);
  });
