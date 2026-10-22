const db = require('../config/db');
const AppError = require('../utils/AppError');
const { ROLES, STATUS, SORTABLE_COLUMNS } = require('../utils/constants');
const { saveSignature, getSignature, deleteIfUnused } = require('./signature.service');
const { isValidDate } = require('../validators/voucher.validator');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VOUCHER_SELECT = `
  SELECT v.*, r.name AS reviewed_by_name
    FROM vouchers v
    LEFT JOIN users r ON r.id = v.reviewed_by`;

/** DB row -> API shape. Signature images are served by a separate endpoint; only flags here. */
function toVoucherDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    voucherNumber: row.voucher_number,
    voucherDate: row.voucher_date,
    expenseDate: row.expense_date,
    department: row.department,
    expenseTitle: row.expense_title,
    expenseCategory: row.expense_category,
    expenseDescription: row.expense_description,
    amount: row.amount,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    employeeCode: row.employee_code,
    hasEmployeeSignature: Boolean(row.employee_signature_id),
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedBy: row.reviewed_by,
    reviewedByName: row.reviewed_by_name || null,
    hasDirectorSignature: Boolean(row.director_signature_id),
    approvalDate: row.approval_date,
    rejectionReason: row.rejection_reason,
    rejectedAt: row.rejected_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Role-based visibility, applied to every read:
 *  - EMPLOYEE  -> only own vouchers (all statuses)
 *  - DIRECTOR / ACCOUNTS -> every voucher in the organisation that has been
 *    submitted (drafts are private work-in-progress of the employee)
 */
function visibilityClause(user, params) {
  if (user.role === ROLES.EMPLOYEE) {
    params.push(user.id);
    return `v.employee_id = $${params.length}`;
  }
  return `v.status <> 'DRAFT'`;
}

async function logActivity(client, voucherId, action, actorId, remarks = null) {
  await client.query(
    'INSERT INTO voucher_activity (voucher_id, action, actor_id, remarks) VALUES ($1, $2, $3, $4)',
    [voucherId, action, actorId, remarks]
  );
}

async function findVoucherForUpdate(client, id) {
  const { rows } = await client.query('SELECT * FROM vouchers WHERE id = $1 FOR UPDATE', [id]);
  if (!rows[0]) throw AppError.notFound('Voucher not found');
  return rows[0];
}

function assertOwnDraft(voucher, user, actionLabel) {
  // Do not reveal other employees' vouchers: answer 404 rather than 403
  if (voucher.employee_id !== user.id) throw AppError.notFound('Voucher not found');
  if (voucher.status !== STATUS.DRAFT) {
    throw AppError.conflict(`Only Draft vouchers can be ${actionLabel}. This voucher is ${voucher.status}.`);
  }
}

function parseId(id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw AppError.badRequest('Invalid voucher id');
  return n;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

async function listVouchers(user, query = {}) {
  const params = [];
  const where = [visibilityClause(user, params)];

  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replace('?', `$${params.length}`));
  };

  if (query.search) {
    params.push(`%${String(query.search).trim()}%`);
    const p = `$${params.length}`;
    where.push(`(v.voucher_number ILIKE ${p} OR v.employee_name ILIKE ${p} OR v.expense_title ILIKE ${p})`);
  }
  if (query.voucherNumber) add('v.voucher_number ILIKE ?', `%${String(query.voucherNumber).trim()}%`);
  if (query.employeeName) add('v.employee_name ILIKE ?', `%${String(query.employeeName).trim()}%`);
  if (query.department) add('v.department = ?', String(query.department));
  if (query.category) add('v.expense_category = ?', String(query.category));

  if (query.status) {
    const statuses = String(query.status)
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const invalid = statuses.filter((s) => !Object.values(STATUS).includes(s));
    if (invalid.length) throw AppError.badRequest(`Invalid status: ${invalid.join(', ')}`);
    add('v.status::text = ANY(?)', statuses);
  }

  if (query.fromDate) {
    if (!isValidDate(String(query.fromDate))) throw AppError.badRequest('fromDate must be YYYY-MM-DD');
    add('v.expense_date >= ?', query.fromDate);
  }
  if (query.toDate) {
    if (!isValidDate(String(query.toDate))) throw AppError.badRequest('toDate must be YYYY-MM-DD');
    add('v.expense_date <= ?', query.toDate);
  }
  if (query.minAmount !== undefined && query.minAmount !== '') {
    const min = Number(query.minAmount);
    if (!Number.isFinite(min)) throw AppError.badRequest('minAmount must be a number');
    add('v.amount >= ?', min);
  }
  if (query.maxAmount !== undefined && query.maxAmount !== '') {
    const max = Number(query.maxAmount);
    if (!Number.isFinite(max)) throw AppError.badRequest('maxAmount must be a number');
    add('v.amount <= ?', max);
  }

  const sortColumn = SORTABLE_COLUMNS[query.sortBy] || SORTABLE_COLUMNS.createdAt;
  const sortOrder = String(query.sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 100);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const offset = (page - 1) * limit;

  const whereSql = `WHERE ${where.join(' AND ')}`;

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total, COALESCE(SUM(v.amount), 0) AS total_amount
       FROM vouchers v ${whereSql}`,
    params
  );

  const { rows } = await db.query(
    `${VOUCHER_SELECT} ${whereSql}
      ORDER BY ${sortColumn} ${sortOrder}, v.id DESC
      LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  const total = countResult.rows[0].total;
  return {
    data: rows.map(toVoucherDto),
    pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
    summary: { totalAmount: countResult.rows[0].total_amount },
  };
}

async function getVoucherRow(user, id) {
  const voucherId = parseId(id);
  const params = [voucherId];
  const visibility = visibilityClause(user, params);
  const { rows } = await db.query(`${VOUCHER_SELECT} WHERE v.id = $1 AND ${visibility}`, params);
  if (!rows[0]) throw AppError.notFound('Voucher not found');
  return rows[0];
}

async function getVoucherDetails(user, id) {
  const row = await getVoucherRow(user, id);
  const activity = await db.query(
    `SELECT a.id, a.action, a.remarks, a.created_at, u.name AS actor_name, u.role AS actor_role
       FROM voucher_activity a JOIN users u ON u.id = a.actor_id
      WHERE a.voucher_id = $1
      ORDER BY a.created_at ASC, a.id ASC`,
    [row.id]
  );
  return {
    ...toVoucherDto(row),
    activity: activity.rows.map((a) => ({
      id: a.id,
      action: a.action,
      remarks: a.remarks,
      actorName: a.actor_name,
      actorRole: a.actor_role,
      createdAt: a.created_at,
    })),
  };
}

/** Returns { mime_type, data } of a voucher signature the user is allowed to view. */
async function getVoucherSignature(user, id, type) {
  if (!['employee', 'director'].includes(type)) throw AppError.badRequest('type must be employee or director');
  const row = await getVoucherRow(user, id);
  const signatureId = type === 'employee' ? row.employee_signature_id : row.director_signature_id;
  if (!signatureId) throw AppError.notFound('Signature not uploaded');
  return getSignature(signatureId);
}

// ---------------------------------------------------------------------------
// Employee actions
// ---------------------------------------------------------------------------

async function createVoucher(user, data, file) {
  return db.withTransaction(async (client) => {
    const signatureId = file ? await saveSignature(client, file, user.id) : null;
    const { rows } = await client.query(
      `INSERT INTO vouchers
         (expense_date, department, expense_title, expense_category, expense_description, amount,
          employee_id, employee_name, employee_code, employee_signature_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'DRAFT')
       RETURNING id`,
      [
        data.expenseDate,
        data.department,
        data.expenseTitle,
        data.expenseCategory,
        data.expenseDescription,
        data.amount,
        user.id,
        user.name,
        user.employee_code,
        signatureId,
      ]
    );
    await logActivity(client, rows[0].id, 'CREATED', user.id, 'Voucher saved as Draft');
    return rows[0].id;
  }).then((id) => getVoucherDetails(user, id));
}

async function updateVoucher(user, id, data, file) {
  const voucherId = parseId(id);

  await db.withTransaction(async (client) => {
    const voucher = await findVoucherForUpdate(client, voucherId);
    assertOwnDraft(voucher, user, 'edited');

    const newSignature = file ? await saveSignature(client, file, user.id) : voucher.employee_signature_id;

    await client.query(
      `UPDATE vouchers
          SET expense_date = $1, department = $2, expense_title = $3, expense_category = $4,
              expense_description = $5, amount = $6, employee_signature_id = $7
        WHERE id = $8`,
      [
        data.expenseDate,
        data.department,
        data.expenseTitle,
        data.expenseCategory,
        data.expenseDescription,
        data.amount,
        newSignature,
        voucherId,
      ]
    );
    if (file) await deleteIfUnused(client, voucher.employee_signature_id);
    await logActivity(client, voucherId, 'UPDATED', user.id, 'Draft updated');
  });

  return getVoucherDetails(user, voucherId);
}

async function deleteVoucher(user, id) {
  const voucherId = parseId(id);
  await db.withTransaction(async (client) => {
    const voucher = await findVoucherForUpdate(client, voucherId);
    assertOwnDraft(voucher, user, 'deleted');
    await client.query('DELETE FROM vouchers WHERE id = $1', [voucherId]);
    await deleteIfUnused(client, voucher.employee_signature_id);
  });
}

async function submitVoucher(user, id) {
  const voucherId = parseId(id);
  await db.withTransaction(async (client) => {
    const voucher = await findVoucherForUpdate(client, voucherId);
    assertOwnDraft(voucher, user, 'submitted');

    // Fall back to the employee's saved signature (signature rows are immutable, so sharing is safe)
    const signature = voucher.employee_signature_id || user.signature_id;
    if (!signature) {
      throw AppError.badRequest('Employee signature is mandatory before submission', {
        employeeSignature: 'Upload your signature before submitting',
      });
    }

    await client.query(
      `UPDATE vouchers
          SET status = 'PENDING_APPROVAL', submitted_at = NOW(), employee_signature_id = $1
        WHERE id = $2`,
      [signature, voucherId]
    );
    await logActivity(client, voucherId, 'SUBMITTED', user.id, 'Submitted for Director approval');
  });
  return getVoucherDetails(user, voucherId);
}

// ---------------------------------------------------------------------------
// Director actions
// ---------------------------------------------------------------------------

async function approveVoucher(user, id, file) {
  const voucherId = parseId(id);
  await db.withTransaction(async (client) => {
    const voucher = await findVoucherForUpdate(client, voucherId);
    if (voucher.status === STATUS.DRAFT) throw AppError.notFound('Voucher not found');
    if (voucher.status !== STATUS.PENDING_APPROVAL) {
      throw AppError.conflict(`Voucher is already ${voucher.status} and cannot be approved`);
    }

    const signature = file ? await saveSignature(client, file, user.id) : user.signature_id;
    if (!signature) {
      throw AppError.badRequest('Director signature is mandatory before approval', {
        directorSignature: 'Upload your signature to approve',
      });
    }

    await client.query(
      `UPDATE vouchers
          SET status = 'APPROVED', reviewed_by = $1, director_signature_id = $2, approval_date = NOW()
        WHERE id = $3`,
      [user.id, signature, voucherId]
    );
    await logActivity(client, voucherId, 'APPROVED', user.id, 'Approved by Director');
  });
  return getVoucherDetails(user, voucherId);
}

async function rejectVoucher(user, id, reason) {
  const voucherId = parseId(id);
  await db.withTransaction(async (client) => {
    const voucher = await findVoucherForUpdate(client, voucherId);
    if (voucher.status === STATUS.DRAFT) throw AppError.notFound('Voucher not found');
    if (voucher.status !== STATUS.PENDING_APPROVAL) {
      throw AppError.conflict(`Voucher is already ${voucher.status} and cannot be rejected`);
    }
    await client.query(
      `UPDATE vouchers
          SET status = 'REJECTED', reviewed_by = $1, rejection_reason = $2, rejected_at = NOW()
        WHERE id = $3`,
      [user.id, reason, voucherId]
    );
    await logActivity(client, voucherId, 'REJECTED', user.id, reason);
  });
  return getVoucherDetails(user, voucherId);
}

module.exports = {
  toVoucherDto,
  listVouchers,
  getVoucherDetails,
  getVoucherSignature,
  createVoucher,
  updateVoucher,
  deleteVoucher,
  submitVoucher,
  approveVoucher,
  rejectVoucher,
};
