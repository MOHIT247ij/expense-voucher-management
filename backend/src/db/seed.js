/**
 * Seeds demo users (one per role + two employees).
 * Safe to run multiple times – existing emails are skipped.
 */
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

const DEMO_PASSWORD = 'Password@123';

const users = [
  { name: 'Rahul Director', email: 'director@abc.com', role: 'DIRECTOR', employee_code: 'DIR001', department: 'Management' },
  { name: 'Anita Accounts', email: 'accounts@abc.com', role: 'ACCOUNTS', employee_code: 'ACC001', department: 'Finance' },
  { name: 'Amit Sharma', email: 'amit@abc.com', role: 'EMPLOYEE', employee_code: 'EMP001', department: 'Sales' },
  { name: 'Priya Patil', email: 'priya@abc.com', role: 'EMPLOYEE', employee_code: 'EMP002', department: 'Information Technology' },
];

async function seed() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const u of users) {
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, employee_code, department)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [u.name, u.email, hash, u.role, u.employee_code, u.department]
    );
    console.log(`${result.rowCount ? '+ created' : '- exists '} ${u.role.padEnd(8)} ${u.email}`);
  }
  console.log(`\nDemo password for all users: ${DEMO_PASSWORD}`);
}

seed()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error('Seeding failed:', err.message);
    await pool.end();
    process.exit(1);
  });
