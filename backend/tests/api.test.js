/**
 * End-to-end API tests (Node's built-in test runner + fetch, no extra deps).
 *
 *   1. Create a separate database, e.g.  createdb expense_voucher_test
 *   2. DB_NAME=expense_voucher_test npm run db:setup
 *   3. DB_NAME=expense_voucher_test npm test
 *
 * For safety the suite refuses to run unless DB_NAME contains "test",
 * because it truncates the voucher tables before running.
 */
process.env.NODE_ENV = 'test';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const app = require('../src/app');
const { pool } = require('../src/config/db');

const PASSWORD = 'Password@123';
// 1x1 transparent PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

let server;
let base;
const tokens = {};

const today = new Date().toISOString().slice(0, 10);
const validVoucher = {
  department: 'Sales',
  expenseTitle: 'Client visit - Mumbai',
  expenseCategory: 'Travel',
  expenseDescription: 'Train tickets and local cab',
  expenseDate: today,
  amount: '1250.50',
};

async function api(method, path, { token, json, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }
  const res = await fetch(`${base}${path}`, { method, headers, body });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await res.json() : await res.arrayBuffer();
  return { status: res.status, data, type };
}

function voucherForm(fields, fileField, file = PNG, mime = 'image/png') {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));
  if (fileField) form.append(fileField, new Blob([file], { type: mime }), 'signature.png');
  return form;
}

before(async () => {
  if (!/test/.test(process.env.DB_NAME || '')) {
    throw new Error('Refusing to run: set DB_NAME to a test database (name must contain "test")');
  }
  await pool.query('TRUNCATE voucher_activity, vouchers RESTART IDENTITY CASCADE');
  await pool.query('UPDATE users SET signature_id = NULL');
  await pool.query('DELETE FROM signatures');
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;

  for (const [role, email] of Object.entries({
    employee: 'amit@abc.com',
    employee2: 'priya@abc.com',
    director: 'director@abc.com',
    accounts: 'accounts@abc.com',
  })) {
    const res = await api('POST', '/auth/login', { json: { email, password: PASSWORD } });
    assert.equal(res.status, 200, `login ${email}`);
    tokens[role] = res.data.data.token;
  }
});

after(async () => {
  server && server.close();
  await pool.end();
});

// ---------------------------------------------------------------- auth
test('login rejects wrong password and missing fields', async () => {
  let res = await api('POST', '/auth/login', { json: { email: 'amit@abc.com', password: 'nope' } });
  assert.equal(res.status, 401);
  res = await api('POST', '/auth/login', { json: {} });
  assert.equal(res.status, 400);
  assert.ok(res.data.errors.email && res.data.errors.password);
});

test('protected routes require a valid token', async () => {
  assert.equal((await api('GET', '/vouchers')).status, 401);
  assert.equal((await api('GET', '/vouchers', { token: 'garbage' })).status, 401);
  const me = await api('GET', '/auth/me', { token: tokens.director });
  assert.equal(me.data.data.role, 'DIRECTOR');
});

// ---------------------------------------------------------------- workflow
const ids = {};

test('validation rules on create', async () => {
  const res = await api('POST', '/vouchers', {
    token: tokens.employee,
    json: { ...validVoucher, department: '', expenseTitle: '', amount: '0', expenseDate: '' },
  });
  assert.equal(res.status, 400);
  assert.deepEqual(Object.keys(res.data.errors).sort(), ['amount', 'department', 'expenseDate', 'expenseTitle']);

  const future = await api('POST', '/vouchers', {
    token: tokens.employee,
    json: { ...validVoucher, expenseDate: '2999-01-01' },
  });
  assert.equal(future.status, 400);
});

test('new vouchers are saved as Draft with an auto-generated number', async () => {
  const res = await api('POST', '/vouchers', { token: tokens.employee, json: validVoucher });
  assert.equal(res.status, 201);
  const v = res.data.data;
  assert.equal(v.status, 'DRAFT');
  assert.match(v.voucherNumber, /^EV-\d{4}-\d{5}$/);
  assert.equal(v.amount, 1250.5);
  assert.equal(v.employeeName, 'Amit Sharma');
  ids.a = v.id;

  const res2 = await api('POST', '/vouchers', {
    token: tokens.employee,
    json: { ...validVoucher, expenseTitle: 'Team lunch', expenseCategory: 'Food & Meals', amount: '800' },
  });
  ids.b = res2.data.data.id;
  assert.notEqual(res2.data.data.voucherNumber, v.voucherNumber);
});

test('employee signature is mandatory before submission', async () => {
  const res = await api('POST', `/vouchers/${ids.a}/submit`, { token: tokens.employee });
  assert.equal(res.status, 400);
  assert.ok(res.data.errors.employeeSignature);
});

test('signature upload rejects non-image files', async () => {
  const form = new FormData();
  form.append('signature', new Blob(['hello'], { type: 'text/plain' }), 'x.txt');
  const res = await api('POST', '/users/me/signature', { token: tokens.employee, form });
  assert.equal(res.status, 400);
});

test('signature upload checks the real file content, not just the MIME type', async () => {
  const form = new FormData();
  form.append('signature', new Blob(['not really a png'], { type: 'image/png' }), 'fake.png');
  const res = await api('POST', '/users/me/signature', { token: tokens.employee, form });
  assert.equal(res.status, 400);
});

test('draft can be edited (with signature upload) and then submitted', async () => {
  const upd = await api('PUT', `/vouchers/${ids.a}`, {
    token: tokens.employee,
    form: voucherForm({ ...validVoucher, amount: '1500' }, 'employeeSignature'),
  });
  assert.equal(upd.status, 200);
  assert.equal(upd.data.data.amount, 1500);
  assert.equal(upd.data.data.hasEmployeeSignature, true);

  const sub = await api('POST', `/vouchers/${ids.a}/submit`, { token: tokens.employee });
  assert.equal(sub.status, 200);
  assert.equal(sub.data.data.status, 'PENDING_APPROVAL');
  assert.ok(sub.data.data.submittedAt);
});

test('saved profile signature is used when submitting', async () => {
  const sig = await api('POST', '/users/me/signature', {
    token: tokens.employee,
    form: voucherForm({}, 'signature'),
  });
  assert.equal(sig.status, 200);
  assert.equal(sig.data.data.hasSignature, true);

  const sub = await api('POST', `/vouchers/${ids.b}/submit`, { token: tokens.employee });
  assert.equal(sub.status, 200);
  assert.equal(sub.data.data.hasEmployeeSignature, true);
});

test('submitted vouchers are read-only for the employee', async () => {
  assert.equal((await api('PUT', `/vouchers/${ids.a}`, { token: tokens.employee, json: validVoucher })).status, 409);
  assert.equal((await api('DELETE', `/vouchers/${ids.a}`, { token: tokens.employee })).status, 409);
  assert.equal((await api('POST', `/vouchers/${ids.a}/submit`, { token: tokens.employee })).status, 409);
});

test('employees only see their own vouchers', async () => {
  const other = await api('POST', '/vouchers', {
    token: tokens.employee2,
    json: { ...validVoucher, department: 'Information Technology', expenseTitle: 'Keyboard', expenseCategory: 'Office Supplies', amount: '2000' },
  });
  ids.other = other.data.data.id;

  const list = await api('GET', '/vouchers', { token: tokens.employee });
  assert.ok(list.data.data.every((v) => v.employeeName === 'Amit Sharma'));
  assert.equal((await api('GET', `/vouchers/${ids.other}`, { token: tokens.employee })).status, 404);
  assert.equal((await api('PUT', `/vouchers/${ids.other}`, { token: tokens.employee, json: validVoucher })).status, 404);
  assert.equal((await api('DELETE', `/vouchers/${ids.other}`, { token: tokens.employee })).status, 404);
});

test('drafts are private to the employee', async () => {
  assert.equal((await api('GET', `/vouchers/${ids.other}`, { token: tokens.director })).status, 404);
  assert.equal((await api('GET', `/vouchers/${ids.other}`, { token: tokens.accounts })).status, 404);
  assert.equal((await api('POST', `/vouchers/${ids.other}/approve`, { token: tokens.director })).status, 404);
});

test('role restrictions: accounts and director cannot create; only director approves', async () => {
  assert.equal((await api('POST', '/vouchers', { token: tokens.accounts, json: validVoucher })).status, 403);
  assert.equal((await api('POST', '/vouchers', { token: tokens.director, json: validVoucher })).status, 403);
  assert.equal((await api('POST', `/vouchers/${ids.a}/approve`, { token: tokens.accounts })).status, 403);
  assert.equal((await api('POST', `/vouchers/${ids.a}/approve`, { token: tokens.employee })).status, 403);
  assert.equal((await api('POST', `/vouchers/${ids.a}/reject`, { token: tokens.accounts, json: { reason: 'x' } })).status, 403);
  assert.equal((await api('PUT', `/vouchers/${ids.a}`, { token: tokens.director, json: validVoucher })).status, 403);
});

test('director signature is mandatory for approval', async () => {
  const res = await api('POST', `/vouchers/${ids.a}/approve`, { token: tokens.director });
  assert.equal(res.status, 400);
  assert.ok(res.data.errors.directorSignature);
});

test('director approves with signature', async () => {
  const res = await api('POST', `/vouchers/${ids.a}/approve`, {
    token: tokens.director,
    form: voucherForm({}, 'directorSignature'),
  });
  assert.equal(res.status, 200);
  const v = res.data.data;
  assert.equal(v.status, 'APPROVED');
  assert.equal(v.hasDirectorSignature, true);
  assert.equal(v.reviewedByName, 'Rahul Director');
  assert.ok(v.approvalDate);
  assert.deepEqual(v.activity.map((a) => a.action), ['CREATED', 'UPDATED', 'SUBMITTED', 'APPROVED']);
});

test('rejection requires a reason and is visible to the employee', async () => {
  const noReason = await api('POST', `/vouchers/${ids.b}/reject`, { token: tokens.director, json: { reason: '  ' } });
  assert.equal(noReason.status, 400);

  const res = await api('POST', `/vouchers/${ids.b}/reject`, {
    token: tokens.director,
    json: { reason: 'Bill copy is missing' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.data.data.status, 'REJECTED');

  const mine = await api('GET', `/vouchers/${ids.b}`, { token: tokens.employee });
  assert.equal(mine.data.data.rejectionReason, 'Bill copy is missing');
});

test('approved / rejected vouchers cannot be processed again', async () => {
  assert.equal((await api('POST', `/vouchers/${ids.b}/reject`, { token: tokens.director, json: { reason: 'Again please' } })).status, 409);
  assert.equal(
    (await api('POST', `/vouchers/${ids.a}/approve`, { token: tokens.director, form: voucherForm({}, 'directorSignature') })).status,
    409
  );
  assert.equal((await api('PUT', `/vouchers/${ids.b}`, { token: tokens.employee, json: validVoucher })).status, 409);
});

test('signatures can be viewed by authorised users only', async () => {
  const emp = await api('GET', `/vouchers/${ids.a}/signatures/employee`, { token: tokens.accounts });
  assert.equal(emp.status, 200);
  assert.match(emp.type, /image\/png/);
  const dir = await api('GET', `/vouchers/${ids.a}/signatures/director`, { token: tokens.accounts });
  assert.equal(dir.status, 200);
  assert.equal((await api('GET', `/vouchers/${ids.a}/signatures/employee`, { token: tokens.employee2 })).status, 404);
  assert.equal((await api('GET', `/vouchers/${ids.a}/signatures/bogus`, { token: tokens.accounts })).status, 400);
});

test('search, filter, sort and pagination', async () => {
  let res = await api('GET', '/vouchers?status=APPROVED', { token: tokens.accounts });
  assert.equal(res.data.pagination.total, 1);
  assert.equal(res.data.data[0].id, ids.a);

  res = await api('GET', '/vouchers?minAmount=1000&maxAmount=2000', { token: tokens.director });
  assert.deepEqual(res.data.data.map((v) => v.id), [ids.a]);

  res = await api('GET', '/vouchers?search=lunch', { token: tokens.director });
  assert.deepEqual(res.data.data.map((v) => v.id), [ids.b]);

  res = await api('GET', `/vouchers?category=${encodeURIComponent('Food & Meals')}&department=Sales`, { token: tokens.director });
  assert.deepEqual(res.data.data.map((v) => v.id), [ids.b]);

  res = await api('GET', `/vouchers?fromDate=${today}&toDate=${today}&sortBy=amount&sortOrder=asc`, { token: tokens.director });
  assert.deepEqual(res.data.data.map((v) => v.amount), [800, 1500]);

  res = await api('GET', '/vouchers?employeeName=amit&limit=1&page=2', { token: tokens.accounts });
  assert.equal(res.data.data.length, 1);
  assert.equal(res.data.pagination.totalPages, 2);

  assert.equal((await api('GET', '/vouchers?status=PAID', { token: tokens.accounts })).status, 400);
  assert.equal((await api('GET', '/vouchers?fromDate=31-12-2026', { token: tokens.accounts })).status, 400);
});

test('dashboards return role specific statistics', async () => {
  const emp = await api('GET', '/dashboard', { token: tokens.employee });
  assert.deepEqual(
    { ...emp.data.data.stats },
    {
      totalVouchers: 2,
      draftVouchers: 0,
      pendingApproval: 0,
      approvedVouchers: 1,
      rejectedVouchers: 1,
      totalAmountClaimed: 2300,
      totalAmountApproved: 1500,
    }
  );

  const dir = await api('GET', '/dashboard', { token: tokens.director });
  assert.equal(dir.data.data.stats.approvedToday, 1);
  assert.equal(dir.data.data.stats.rejectedToday, 1);
  assert.equal(dir.data.data.stats.pendingApprovalCount, 0);
  assert.ok(dir.data.data.recentActivity.length >= 4);

  const acc = await api('GET', '/dashboard', { token: tokens.accounts });
  assert.equal(acc.data.data.stats.totalVouchers, 2); // drafts excluded
  assert.equal(acc.data.data.stats.totalApprovedAmount, 1500);
  assert.equal(acc.data.data.recentApprovedVouchers.length, 1);
});

test('employee can delete own draft', async () => {
  const res = await api('DELETE', `/vouchers/${ids.other}`, { token: tokens.employee2 });
  assert.equal(res.status, 200);
  assert.equal((await api('GET', `/vouchers/${ids.other}`, { token: tokens.employee2 })).status, 404);
});
