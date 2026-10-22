import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../utils/format';

const NAV = {
  EMPLOYEE: [
    { to: '/dashboard', label: 'Dashboard', icon: '▦' },
    { to: '/vouchers/new', label: 'Create Voucher', icon: '+' },
    { to: '/my-vouchers', label: 'My Vouchers', icon: '≡' },
    { to: '/profile', label: 'My Signature', icon: '✎' },
  ],
  DIRECTOR: [
    { to: '/dashboard', label: 'Dashboard', icon: '▦' },
    { to: '/approvals', label: 'Pending Approvals', icon: '⏳' },
    { to: '/vouchers', label: 'All Vouchers', icon: '≡' },
    { to: '/profile', label: 'My Signature', icon: '✎' },
  ],
  ACCOUNTS: [
    { to: '/dashboard', label: 'Dashboard', icon: '▦' },
    { to: '/vouchers', label: 'All Vouchers', icon: '≡' },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">EV</span>
          <div>
            <strong>Expense Vouchers</strong>
            <small>ABC Company</small>
          </div>
        </div>
        <nav onClick={() => setOpen(false)}>
          {NAV[user.role].map((item) => (
            <NavLink key={item.to} to={item.to} end className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <span className="avatar">{initials}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{ROLE_LABELS[user.role]}</small>
            </div>
          </div>
          <button className="btn btn-ghost btn-block" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>
      {open && <div className="backdrop" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="menu-btn" aria-label="Open menu" onClick={() => setOpen(true)}>
            ☰
          </button>
          <span className="topbar-title">Expense Voucher Management</span>
          <span className={`role-pill role-${user.role.toLowerCase()}`}>{ROLE_LABELS[user.role]}</span>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
