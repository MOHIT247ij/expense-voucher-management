import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DEMO_USERS = [
  { label: 'Employee', email: 'amit@abc.com' },
  { label: 'Director', email: 'director@abc.com' },
  { label: 'Accounts', email: 'accounts@abc.com' },
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const validate = () => {
    const e = {};
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email';
    if (!form.password) e.password = 'Password is required';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) return;
    setSubmitting(true);
    try {
      await login(form.email.trim(), form.password);
      const to = location.state?.from?.pathname || '/dashboard';
      navigate(to, { replace: true });
    } catch (err) {
      setErrors({ form: err.message, ...err.errors });
    } finally {
      setSubmitting(false);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-intro">
          <span className="brand-mark lg">EV</span>
          <h1>Expense Voucher Management</h1>
          <p>Create, approve and track employee expense vouchers — no more paper forms.</p>
          <ul className="flow-list">
            <li>Employee creates &amp; submits voucher</li>
            <li>Director approves or rejects</li>
            <li>Accounts processes reimbursement</li>
          </ul>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <h2>Sign in</h2>
          {errors.form && <div className="alert alert-error">{errors.form}</div>}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="username" value={form.email} onChange={set('email')} />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={set('password')}
            />
            {errors.password && <span className="field-error">{errors.password}</span>}
          </div>

          <button className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="demo-users">
            <span className="muted">Demo accounts (password: Password@123)</span>
            <div className="demo-buttons">
              {DEMO_USERS.map((d) => (
                <button
                  type="button"
                  key={d.email}
                  className="btn btn-ghost btn-sm"
                  onClick={() => setForm({ email: d.email, password: 'Password@123' })}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
