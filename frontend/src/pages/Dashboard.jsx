import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { voucherApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';
import { formatCurrency, formatDate, formatDateTime } from '../utils/format';

function MiniVoucherList({ vouchers, empty, showEmployee }) {
  if (!vouchers.length) return <p className="muted empty-inline">{empty}</p>;
  return (
    <ul className="mini-list">
      {vouchers.map((v) => (
        <li key={v.id}>
          <Link to={`/vouchers/${v.id}`}>
            <div>
              <strong className="mono">{v.voucherNumber}</strong>
              <span className="muted">
                {showEmployee ? `${v.employeeName} · ` : ''}
                {v.expenseTitle}
              </span>
            </div>
            <div className="mini-right">
              <strong>{formatCurrency(v.amount)}</strong>
              <StatusBadge status={v.status} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const ACTION_TEXT = {
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

function EmployeeDashboard({ data }) {
  const s = data.stats;
  return (
    <>
      <div className="stats-grid">
        <StatCard label="Total Vouchers" value={s.totalVouchers} />
        <StatCard label="Draft" value={s.draftVouchers} tone="neutral" />
        <StatCard label="Pending Approval" value={s.pendingApproval} tone="warning" />
        <StatCard label="Approved" value={s.approvedVouchers} tone="success" />
        <StatCard label="Rejected" value={s.rejectedVouchers} tone="danger" />
        <StatCard
          label="Total Amount Claimed"
          value={formatCurrency(s.totalAmountClaimed)}
          tone="primary"
          hint={`${formatCurrency(s.totalAmountApproved)} approved`}
        />
      </div>
      <div className="card">
        <div className="card-header">
          <h2>Recent vouchers</h2>
          <Link to="/my-vouchers" className="btn btn-link">
            View all →
          </Link>
        </div>
        <MiniVoucherList vouchers={data.recentVouchers} empty="You have not created any vouchers yet." />
      </div>
    </>
  );
}

function DirectorDashboard({ data }) {
  const s = data.stats;
  return (
    <>
      <div className="stats-grid">
        <StatCard label="Pending Approval" value={s.pendingApprovalCount} tone="warning" />
        <StatCard label="Approved Today" value={s.approvedToday} tone="success" />
        <StatCard label="Rejected Today" value={s.rejectedToday} tone="danger" />
        <StatCard label="Total Pending Amount" value={formatCurrency(s.totalPendingAmount)} tone="primary" />
      </div>
      <div className="card">
        <div className="card-header">
          <h2>Recent voucher activity</h2>
          <Link to="/approvals" className="btn btn-link">
            Review pending →
          </Link>
        </div>
        {data.recentActivity.length === 0 ? (
          <p className="muted empty-inline">No activity yet.</p>
        ) : (
          <ul className="activity-list">
            {data.recentActivity.map((a) => (
              <li key={a.id}>
                <span className={`dot dot-${a.action.toLowerCase()}`} />
                <div>
                  <Link to={`/vouchers/${a.voucherId}`} className="mono">
                    {a.voucherNumber}
                  </Link>{' '}
                  ({formatCurrency(a.amount)}) was {ACTION_TEXT[a.action]} by <strong>{a.actorName}</strong>
                  {a.action === 'REJECTED' && a.remarks && <div className="muted small">Reason: {a.remarks}</div>}
                  <div className="muted small">{formatDateTime(a.createdAt)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function AccountsDashboard({ data }) {
  const s = data.stats;
  return (
    <>
      <div className="stats-grid">
        <StatCard label="Total Vouchers" value={s.totalVouchers} />
        <StatCard label="Pending Approval" value={s.pendingApproval} tone="warning" />
        <StatCard label="Approved" value={s.approvedVouchers} tone="success" />
        <StatCard label="Rejected" value={s.rejectedVouchers} tone="danger" />
        <StatCard label="Total Approved Amount" value={formatCurrency(s.totalApprovedAmount)} tone="primary" />
      </div>
      <div className="card">
        <div className="card-header">
          <h2>Recently approved — ready for reimbursement</h2>
          <Link to="/vouchers?status=APPROVED" className="btn btn-link">
            View all →
          </Link>
        </div>
        {data.recentApprovedVouchers.length === 0 ? (
          <p className="muted empty-inline">No approved vouchers yet.</p>
        ) : (
          <ul className="mini-list">
            {data.recentApprovedVouchers.map((v) => (
              <li key={v.id}>
                <Link to={`/vouchers/${v.id}`}>
                  <div>
                    <strong className="mono">{v.voucherNumber}</strong>
                    <span className="muted">
                      {v.employeeName} · {v.department} · approved {formatDate(v.approvalDate)}
                    </span>
                  </div>
                  <div className="mini-right">
                    <strong>{formatCurrency(v.amount)}</strong>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    voucherApi
      .dashboard()
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message));
  }, []);

  const firstName = user.name.split(' ')[0];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Welcome, {firstName}</h1>
          <p className="muted">Here is an overview of expense vouchers.</p>
        </div>
        {user.role === 'EMPLOYEE' && (
          <Link to="/vouchers/new" className="btn btn-primary">
            + Create Voucher
          </Link>
        )}
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {!data && !error && <Loader />}
      {data && user.role === 'EMPLOYEE' && <EmployeeDashboard data={data} />}
      {data && user.role === 'DIRECTOR' && <DirectorDashboard data={data} />}
      {data && user.role === 'ACCOUNTS' && <AccountsDashboard data={data} />}
    </div>
  );
}
