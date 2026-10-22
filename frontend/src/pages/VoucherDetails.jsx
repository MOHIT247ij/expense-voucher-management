import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { authApi, voucherApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import StatusBadge from '../components/StatusBadge';
import SecureImage from '../components/SecureImage';
import SignatureInput from '../components/SignatureInput';
import Modal from '../components/Modal';
import Loader from '../components/Loader';
import { formatCurrency, formatDate, formatDateTime } from '../utils/format';

const Item = ({ label, children, wide }) => (
  <div className={`detail-item ${wide ? 'wide' : ''}`}>
    <span className="detail-label">{label}</span>
    <span className="detail-value">{children || '—'}</span>
  </div>
);

const ACTION_LABELS = {
  CREATED: 'Created as Draft',
  UPDATED: 'Draft updated',
  SUBMITTED: 'Submitted for approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

function ApproveModal({ voucher, onClose, onDone }) {
  const { user } = useAuth();
  const notify = useToast();
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const approve = async () => {
    if (!file && !user.hasSignature) {
      setError('Director signature is mandatory before approval');
      return;
    }
    setBusy(true);
    try {
      await voucherApi.approve(voucher.id, file);
      notify(`Voucher ${voucher.voucherNumber} approved`);
      onDone();
    } catch (err) {
      setError(err.errors?.directorSignature || err.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Approve ${voucher.voucherNumber}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-success" onClick={approve} disabled={busy}>
            {busy ? 'Approving…' : 'Approve voucher'}
          </button>
        </>
      }
    >
      <p>
        Approve <strong>{formatCurrency(voucher.amount)}</strong> claimed by <strong>{voucher.employeeName}</strong>?
      </p>
      {user.hasSignature && !file && (
        <div className="current-signature">
          <span className="muted small">Your saved signature will be attached</span>
          <SecureImage load={authApi.signatureBlob} alt="Saved director signature" />
        </div>
      )}
      <SignatureInput
        label={user.hasSignature ? 'Use a different signature (optional)' : 'Director signature *'}
        value={file}
        onChange={(f) => {
          setFile(f);
          setError('');
        }}
        error={error}
      />
    </Modal>
  );
}

function RejectModal({ voucher, onClose, onDone }) {
  const notify = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reject = async () => {
    const r = reason.trim();
    if (!r) return setError('Rejection reason is required');
    if (r.length < 5) return setError('Please give a clearer reason (at least 5 characters)');
    setBusy(true);
    try {
      await voucherApi.reject(voucher.id, r);
      notify(`Voucher ${voucher.voucherNumber} rejected`);
      onDone();
    } catch (err) {
      setError(err.errors?.reason || err.message);
      setBusy(false);
    }
    return undefined;
  };

  return (
    <Modal
      title={`Reject ${voucher.voucherNumber}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={reject} disabled={busy}>
            {busy ? 'Rejecting…' : 'Reject voucher'}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="reason">
          Rejection reason <span className="req">*</span>
        </label>
        <textarea
          id="reason"
          rows={4}
          maxLength={1000}
          autoFocus
          placeholder="Explain why this voucher is rejected (visible to the employee)"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setError('');
          }}
        />
        {error && <span className="field-error">{error}</span>}
      </div>
    </Modal>
  );
}

export default function VoucherDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const notify = useToast();
  const navigate = useNavigate();
  const [voucher, setVoucher] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    voucherApi
      .get(id)
      .then((res) => setVoucher(res.data))
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    setVoucher(null);
    setError('');
    load();
  }, [load]);

  if (error) {
    return (
      <div className="page">
        <div className="alert alert-error">{error}</div>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>
    );
  }
  if (!voucher) return <Loader />;

  const isOwnDraft = user.role === 'EMPLOYEE' && voucher.status === 'DRAFT' && voucher.employeeId === user.id;
  const canReview = user.role === 'DIRECTOR' && voucher.status === 'PENDING_APPROVAL';

  const submit = async () => {
    setBusy(true);
    try {
      await voucherApi.submit(voucher.id);
      notify('Voucher submitted for approval');
      load();
    } catch (err) {
      notify(err.message, 'error');
      if (err.errors?.employeeSignature) navigate(`/vouchers/${voucher.id}/edit`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await voucherApi.remove(voucher.id);
      notify('Draft deleted');
      navigate('/my-vouchers', { replace: true });
    } catch (err) {
      notify(err.message, 'error');
      setBusy(false);
      setModal(null);
    }
  };

  return (
    <div className="page">
      <div className="page-header no-print">
        <div>
          <button className="btn btn-link back-link" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <h1>
            Voucher <span className="mono">{voucher.voucherNumber}</span>
          </h1>
        </div>
        <div className="header-actions">
          {isOwnDraft && (
            <>
              <button className="btn btn-ghost danger-text" onClick={() => setModal('delete')} disabled={busy}>
                Delete
              </button>
              <Link to={`/vouchers/${voucher.id}/edit`} className="btn btn-secondary">
                Edit
              </Link>
              <button className="btn btn-primary" onClick={submit} disabled={busy}>
                {busy ? 'Submitting…' : 'Submit for Approval'}
              </button>
            </>
          )}
          {canReview && (
            <>
              <button className="btn btn-danger" onClick={() => setModal('reject')}>
                Reject
              </button>
              <button className="btn btn-success" onClick={() => setModal('approve')}>
                Approve
              </button>
            </>
          )}
          {voucher.status !== 'DRAFT' && (
            <button className="btn btn-ghost" onClick={() => window.print()}>
              Print / PDF
            </button>
          )}
        </div>
      </div>

      {voucher.status === 'REJECTED' && (
        <div className="alert alert-error">
          <strong>Rejected by {voucher.reviewedByName || 'Director'}:</strong> {voucher.rejectionReason}
        </div>
      )}
      {voucher.status === 'APPROVED' && user.role === 'ACCOUNTS' && (
        <div className="alert alert-success no-print">Approved — ready for reimbursement processing.</div>
      )}

      <div className="voucher-sheet card">
        <div className="sheet-header">
          <div>
            <h2>Expense Voucher</h2>
            <span className="muted">ABC Company</span>
          </div>
          <div className="sheet-meta">
            <StatusBadge status={voucher.status} />
            <span className="mono">{voucher.voucherNumber}</span>
          </div>
        </div>

        <h3 className="section-title">Basic information</h3>
        <div className="detail-grid">
          <Item label="Voucher number">
            <span className="mono">{voucher.voucherNumber}</span>
          </Item>
          <Item label="Voucher date">{formatDate(voucher.voucherDate)}</Item>
          <Item label="Expense date">{formatDate(voucher.expenseDate)}</Item>
          <Item label="Department">{voucher.department}</Item>
          <Item label="Expense category">{voucher.expenseCategory}</Item>
          <Item label="Amount">
            <strong className="amount">{formatCurrency(voucher.amount)}</strong>
          </Item>
          <Item label="Expense title" wide>
            {voucher.expenseTitle}
          </Item>
          <Item label="Expense description" wide>
            {voucher.expenseDescription}
          </Item>
        </div>

        <h3 className="section-title">Employee information</h3>
        <div className="detail-grid">
          <Item label="Employee name">{voucher.employeeName}</Item>
          <Item label="Employee ID">{voucher.employeeCode}</Item>
          <Item label="Submitted on">{formatDateTime(voucher.submittedAt)}</Item>
        </div>

        <h3 className="section-title">Approval information</h3>
        <div className="detail-grid">
          <Item label="Current status">
            <StatusBadge status={voucher.status} />
          </Item>
          <Item label="Reviewed by">{voucher.reviewedByName}</Item>
          <Item label="Approval date">{formatDateTime(voucher.approvalDate)}</Item>
          {voucher.status === 'REJECTED' && (
            <>
              <Item label="Rejected on">{formatDateTime(voucher.rejectedAt)}</Item>
              <Item label="Rejection reason" wide>
                {voucher.rejectionReason}
              </Item>
            </>
          )}
        </div>

        <div className="signatures">
          <div>
            <span className="detail-label">Employee signature</span>
            {voucher.hasEmployeeSignature ? (
              <SecureImage load={() => voucherApi.signatureBlob(voucher.id, 'employee')} alt="Employee signature" deps={[voucher.id, voucher.updatedAt]} />
            ) : (
              <div className="signature-box empty">Not uploaded</div>
            )}
            <span className="muted small">{voucher.employeeName}</span>
          </div>
          <div>
            <span className="detail-label">Director signature</span>
            {voucher.hasDirectorSignature ? (
              <SecureImage load={() => voucherApi.signatureBlob(voucher.id, 'director')} alt="Director signature" deps={[voucher.id, voucher.updatedAt]} />
            ) : (
              <div className="signature-box empty">
                {{ REJECTED: 'Rejected', DRAFT: 'Not submitted yet' }[voucher.status] || 'Awaiting approval'}
              </div>
            )}
            <span className="muted small">{voucher.reviewedByName || 'Director'}</span>
          </div>
        </div>

        <h3 className="section-title">Audit information</h3>
        <div className="detail-grid">
          <Item label="Created date">{formatDateTime(voucher.createdAt)}</Item>
          <Item label="Last updated date">{formatDateTime(voucher.updatedAt)}</Item>
        </div>

        {voucher.activity?.length > 0 && (
          <div className="no-print">
            <h3 className="section-title">Timeline</h3>
            <ol className="timeline">
              {voucher.activity.map((a) => (
                <li key={a.id} className={`tl-${a.action.toLowerCase()}`}>
                  <strong>{ACTION_LABELS[a.action] || a.action}</strong> by {a.actorName}
                  <div className="muted small">{formatDateTime(a.createdAt)}</div>
                  {a.action === 'REJECTED' && a.remarks && <div className="small">“{a.remarks}”</div>}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {modal === 'approve' && (
        <ApproveModal
          voucher={voucher}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            load();
          }}
        />
      )}
      {modal === 'reject' && (
        <RejectModal
          voucher={voucher}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            load();
          }}
        />
      )}
      {modal === 'delete' && (
        <Modal
          title="Delete draft?"
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={remove} disabled={busy}>
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </>
          }
        >
          <p>
            Voucher <strong>{voucher.voucherNumber}</strong> will be permanently deleted.
          </p>
        </Modal>
      )}
    </div>
  );
}
