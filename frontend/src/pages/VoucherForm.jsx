import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { authApi, voucherApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useMeta from '../components/useMeta';
import SignatureInput from '../components/SignatureInput';
import SecureImage from '../components/SecureImage';
import Loader from '../components/Loader';
import { todayISO } from '../utils/format';

const EMPTY = {
  department: '',
  expenseTitle: '',
  expenseCategory: '',
  expenseDescription: '',
  expenseDate: '',
  amount: '',
};

function validate(form) {
  const e = {};
  if (!form.department) e.department = 'Department is required';
  if (!form.expenseTitle.trim()) e.expenseTitle = 'Expense title is required';
  else if (form.expenseTitle.trim().length > 150) e.expenseTitle = 'Maximum 150 characters';
  if (!form.expenseCategory) e.expenseCategory = 'Expense category is required';
  if (!form.expenseDate) e.expenseDate = 'Expense date is required';
  else if (form.expenseDate > todayISO()) e.expenseDate = 'Expense date cannot be in the future';
  if (form.amount === '' || form.amount === null) e.amount = 'Amount is required';
  else if (!(Number(form.amount) > 0)) e.amount = 'Amount must be greater than zero';
  else if (!/^\d+(\.\d{1,2})?$/.test(String(form.amount))) e.amount = 'At most 2 decimal places';
  if (form.expenseDescription.length > 2000) e.expenseDescription = 'Maximum 2000 characters';
  return e;
}

/** Create a new voucher or edit an existing Draft. */
export default function VoucherForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const notify = useToast();
  const { user } = useAuth();
  const { departments, categories } = useMeta();

  const [form, setForm] = useState({ ...EMPTY, department: user.department || '' });
  const [existing, setExisting] = useState(null);
  const [signature, setSignature] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    voucherApi
      .get(id)
      .then(({ data }) => {
        if (data.status !== 'DRAFT') {
          notify('Only Draft vouchers can be edited', 'error');
          navigate(`/vouchers/${id}`, { replace: true });
          return;
        }
        setExisting(data);
        setForm({
          department: data.department,
          expenseTitle: data.expenseTitle,
          expenseCategory: data.expenseCategory,
          expenseDescription: data.expenseDescription || '',
          expenseDate: data.expenseDate,
          amount: String(data.amount),
        });
      })
      .catch((err) => {
        notify(err.message, 'error');
        navigate('/my-vouchers', { replace: true });
      })
      .finally(() => setLoading(false));
  }, [id, isEdit, navigate, notify]);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const hasAnySignature = Boolean(signature || existing?.hasEmployeeSignature || user.hasSignature);

  const save = async (andSubmit) => {
    const v = validate(form);
    if (andSubmit && !hasAnySignature) v.employeeSignature = 'Employee signature is mandatory before submission';
    setErrors(v);
    if (Object.keys(v).length) {
      notify('Please fix the highlighted fields', 'error');
      return;
    }

    setSaving(andSubmit ? 'submit' : 'draft');
    const payload = { ...form, expenseTitle: form.expenseTitle.trim(), expenseDescription: form.expenseDescription.trim() };
    let saved = existing;
    try {
      const res = isEdit
        ? await voucherApi.update(id, payload, signature)
        : await voucherApi.create(payload, signature);
      saved = res.data;

      if (andSubmit) {
        await voucherApi.submit(saved.id);
        notify(`Voucher ${saved.voucherNumber} submitted for approval`);
      } else {
        notify(`Voucher ${saved.voucherNumber} saved as Draft`);
      }
      navigate(`/vouchers/${saved.id}`);
    } catch (err) {
      setErrors({ form: err.message, ...err.errors });
      notify(err.message, 'error');
      // Draft was created but submission failed: continue editing that draft
      if (!isEdit && saved?.id) navigate(`/vouchers/${saved.id}/edit`, { replace: true });
    } finally {
      setSaving('');
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="page narrow">
      <div className="page-header">
        <div>
          <h1>{isEdit ? `Edit Draft ${existing?.voucherNumber || ''}` : 'Create Voucher'}</h1>
          <p className="muted">
            Voucher number is generated automatically. A voucher stays editable while it is a Draft.
          </p>
        </div>
      </div>

      <form
        className="card form-card"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save(false);
        }}
      >
        {errors.form && <div className="alert alert-error">{errors.form}</div>}

        <section>
          <h3 className="section-title">Basic information</h3>
          <div className="form-grid">
            <div className="field">
              <label>Employee</label>
              <input value={`${user.name}${user.employeeCode ? ` (${user.employeeCode})` : ''}`} disabled />
            </div>
            <div className="field">
              <label htmlFor="department">
                Department <span className="req">*</span>
              </label>
              <select id="department" value={form.department} onChange={set('department')}>
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
              {errors.department && <span className="field-error">{errors.department}</span>}
            </div>
            <div className="field span-2">
              <label htmlFor="expenseTitle">
                Expense title <span className="req">*</span>
              </label>
              <input
                id="expenseTitle"
                value={form.expenseTitle}
                maxLength={150}
                placeholder="e.g. Client visit to Mumbai"
                onChange={set('expenseTitle')}
              />
              {errors.expenseTitle && <span className="field-error">{errors.expenseTitle}</span>}
            </div>
            <div className="field">
              <label htmlFor="expenseCategory">
                Expense category <span className="req">*</span>
              </label>
              <select id="expenseCategory" value={form.expenseCategory} onChange={set('expenseCategory')}>
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              {errors.expenseCategory && <span className="field-error">{errors.expenseCategory}</span>}
            </div>
            <div className="field">
              <label htmlFor="expenseDate">
                Expense date <span className="req">*</span>
              </label>
              <input id="expenseDate" type="date" max={todayISO()} value={form.expenseDate} onChange={set('expenseDate')} />
              {errors.expenseDate && <span className="field-error">{errors.expenseDate}</span>}
            </div>
            <div className="field">
              <label htmlFor="amount">
                Amount (₹) <span className="req">*</span>
              </label>
              <input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={form.amount}
                onChange={set('amount')}
              />
              {errors.amount && <span className="field-error">{errors.amount}</span>}
            </div>
            <div className="field span-2">
              <label htmlFor="expenseDescription">Expense description</label>
              <textarea
                id="expenseDescription"
                rows={3}
                maxLength={2000}
                placeholder="Add details such as purpose, bill numbers, people involved…"
                value={form.expenseDescription}
                onChange={set('expenseDescription')}
              />
              {errors.expenseDescription && <span className="field-error">{errors.expenseDescription}</span>}
            </div>
          </div>
        </section>

        <section>
          <h3 className="section-title">Employee signature</h3>
          {existing?.hasEmployeeSignature && !signature && (
            <div className="current-signature">
              <span className="muted small">Current signature on this voucher</span>
              <SecureImage load={() => voucherApi.signatureBlob(existing.id, 'employee')} alt="Current signature" deps={[existing.id]} />
            </div>
          )}
          {!existing?.hasEmployeeSignature && user.hasSignature && !signature && (
            <div className="current-signature">
              <span className="muted small">Your saved signature will be used when you submit</span>
              <SecureImage load={authApi.signatureBlob} alt="Saved signature" />
            </div>
          )}
          <SignatureInput
            label={existing?.hasEmployeeSignature || user.hasSignature ? 'Upload a different signature (optional)' : 'Upload signature'}
            value={signature}
            onChange={setSignature}
            error={errors.employeeSignature}
          />
        </section>

        <div className="form-actions">
          <Link to={isEdit ? `/vouchers/${id}` : '/my-vouchers'} className="btn btn-ghost">
            Cancel
          </Link>
          <button type="submit" className="btn btn-secondary" disabled={Boolean(saving)}>
            {saving === 'draft' ? 'Saving…' : 'Save as Draft'}
          </button>
          <button type="button" className="btn btn-primary" disabled={Boolean(saving)} onClick={() => save(true)}>
            {saving === 'submit' ? 'Submitting…' : 'Save & Submit for Approval'}
          </button>
        </div>
      </form>
    </div>
  );
}
