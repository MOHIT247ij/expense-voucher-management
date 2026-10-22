import { useState } from 'react';
import { authApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import SignatureInput from '../components/SignatureInput';
import SecureImage from '../components/SecureImage';
import { ROLE_LABELS } from '../utils/format';

/** Lets Employees and the Director save a signature that is reused on vouchers. */
export default function Profile() {
  const { user, setUser } = useAuth();
  const notify = useToast();
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);

  const save = async () => {
    if (!file) {
      setError('Choose an image first');
      return;
    }
    setSaving(true);
    try {
      const res = await authApi.uploadSignature(file);
      setUser(res.data);
      setFile(null);
      setVersion((v) => v + 1);
      notify('Signature saved');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page narrow">
      <div className="page-header">
        <div>
          <h1>My Signature</h1>
          <p className="muted">
            {user.role === 'DIRECTOR'
              ? 'Your saved signature is attached automatically when you approve a voucher.'
              : 'Your saved signature is attached automatically when you submit a voucher.'}
          </p>
        </div>
      </div>

      <div className="card form-card">
        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">Name</span>
            <span className="detail-value">{user.name}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Role</span>
            <span className="detail-value">{ROLE_LABELS[user.role]}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Email</span>
            <span className="detail-value">{user.email}</span>
          </div>
        </div>

        <h3 className="section-title">Saved signature</h3>
        {user.hasSignature ? (
          <SecureImage load={authApi.signatureBlob} alt="Saved signature" deps={[version]} />
        ) : (
          <div className="signature-box empty">No signature saved yet</div>
        )}

        <SignatureInput
          label={user.hasSignature ? 'Replace signature' : 'Upload signature'}
          value={file}
          onChange={(f) => {
            setFile(f);
            setError('');
          }}
          error={error}
        />
        <div className="form-actions">
          <button className="btn btn-primary" onClick={save} disabled={saving || !file}>
            {saving ? 'Saving…' : 'Save signature'}
          </button>
        </div>
      </div>
    </div>
  );
}
