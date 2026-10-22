const db = require('../config/db');
const { ROLES } = require('../utils/constants');
const { timezone } = require('../config/env');
const { toVoucherDto } = require('./voucher.service');

async function employeeDashboard(user) {
  const { rows } = await db.query(
    `SELECT
        COUNT(*)::int                                                     AS total,
        COUNT(*) FILTER (WHERE status = 'DRAFT')::int                     AS draft,
        COUNT(*) FILTER (WHERE status = 'PENDING_APPROVAL')::int          AS pending,
        COUNT(*) FILTER (WHERE status = 'APPROVED')::int                  AS approved,
        COUNT(*) FILTER (WHERE status = 'REJECTED')::int                  AS rejected,
        COALESCE(SUM(amount) FILTER (WHERE status <> 'DRAFT'), 0)         AS total_claimed,
        COALESCE(SUM(amount) FILTER (WHERE status = 'APPROVED'), 0)       AS total_approved
       FROM vouchers WHERE employee_id = $1`,
    [user.id]
  );
  const recent = await db.query(
    `SELECT * FROM vouchers WHERE employee_id = $1 ORDER BY updated_at DESC LIMIT 5`,
    [user.id]
  );
  const s = rows[0];
  return {
    role: user.role,
    stats: {
      totalVouchers: s.total,
      draftVouchers: s.draft,
      pendingApproval: s.pending,
      approvedVouchers: s.approved,
      rejectedVouchers: s.rejected,
      totalAmountClaimed: s.total_claimed,
      totalAmountApproved: s.total_approved,
    },
    recentVouchers: recent.rows.map(toVoucherDto),
  };
}

async function directorDashboard(user) {
  const { rows } = await db.query(
    `SELECT
        COUNT(*) FILTER (WHERE status = 'PENDING_APPROVAL')::int                       AS pending,
        COUNT(*) FILTER (WHERE status = 'APPROVED'
             AND (approval_date AT TIME ZONE $1)::date = (NOW() AT TIME ZONE $1)::date)::int AS approved_today,
        COUNT(*) FILTER (WHERE status = 'REJECTED'
             AND (rejected_at AT TIME ZONE $1)::date = (NOW() AT TIME ZONE $1)::date)::int   AS rejected_today,
        COALESCE(SUM(amount) FILTER (WHERE status = 'PENDING_APPROVAL'), 0)             AS pending_amount,
        COUNT(*) FILTER (WHERE status <> 'DRAFT')::int                                  AS total
       FROM vouchers`,
    [timezone]
  );
  const activity = await db.query(
    `SELECT a.id, a.action, a.remarks, a.created_at,
            u.name AS actor_name, u.role AS actor_role,
            v.id AS voucher_id, v.voucher_number, v.employee_name, v.amount, v.status
       FROM voucher_activity a
       JOIN vouchers v ON v.id = a.voucher_id
       JOIN users u ON u.id = a.actor_id
      WHERE a.action IN ('SUBMITTED', 'APPROVED', 'REJECTED')
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT 10`
  );
  const s = rows[0];
  return {
    role: user.role,
    stats: {
      pendingApprovalCount: s.pending,
      approvedToday: s.approved_today,
      rejectedToday: s.rejected_today,
      totalPendingAmount: s.pending_amount,
      totalVouchers: s.total,
    },
    recentActivity: activity.rows.map((a) => ({
      id: a.id,
      action: a.action,
      remarks: a.remarks,
      createdAt: a.created_at,
      actorName: a.actor_name,
      actorRole: a.actor_role,
      voucherId: a.voucher_id,
      voucherNumber: a.voucher_number,
      employeeName: a.employee_name,
      amount: a.amount,
      status: a.status,
    })),
  };
}

async function accountsDashboard(user) {
  const { rows } = await db.query(
    `SELECT
        COUNT(*)::int                                                AS total,
        COUNT(*) FILTER (WHERE status = 'PENDING_APPROVAL')::int     AS pending,
        COUNT(*) FILTER (WHERE status = 'APPROVED')::int             AS approved,
        COUNT(*) FILTER (WHERE status = 'REJECTED')::int             AS rejected,
        COALESCE(SUM(amount) FILTER (WHERE status = 'APPROVED'), 0)  AS approved_amount
       FROM vouchers WHERE status <> 'DRAFT'`
  );
  const recent = await db.query(
    `SELECT v.*, r.name AS reviewed_by_name
       FROM vouchers v LEFT JOIN users r ON r.id = v.reviewed_by
      WHERE v.status = 'APPROVED'
      ORDER BY v.approval_date DESC
      LIMIT 10`
  );
  const s = rows[0];
  return {
    role: user.role,
    stats: {
      totalVouchers: s.total,
      pendingApproval: s.pending,
      approvedVouchers: s.approved,
      rejectedVouchers: s.rejected,
      totalApprovedAmount: s.approved_amount,
    },
    recentApprovedVouchers: recent.rows.map(toVoucherDto),
  };
}

function getDashboard(user) {
  switch (user.role) {
    case ROLES.EMPLOYEE:
      return employeeDashboard(user);
    case ROLES.DIRECTOR:
      return directorDashboard(user);
    case ROLES.ACCOUNTS:
      return accountsDashboard(user);
    default:
      throw new Error(`Unknown role ${user.role}`);
  }
}

module.exports = { getDashboard };
