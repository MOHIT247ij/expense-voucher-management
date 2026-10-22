import { Link, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import VoucherForm from './pages/VoucherForm';
import VoucherDetails from './pages/VoucherDetails';
import VoucherList, { CreateVoucherButton } from './pages/VoucherList';
import Profile from './pages/Profile';

const REVIEW_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'];

function Message({ title, text }) {
  return (
    <div className="page">
      <div className="card empty-state">
        <h2>{title}</h2>
        <p className="muted">{text}</p>
        <Link to="/dashboard" className="btn btn-primary">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Any logged-in user */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/vouchers/:id" element={<VoucherDetails />} />

          {/* Employee */}
          <Route element={<ProtectedRoute roles={['EMPLOYEE']} />}>
            <Route path="/vouchers/new" element={<VoucherForm />} />
            <Route path="/vouchers/:id/edit" element={<VoucherForm />} />
            <Route
              path="/my-vouchers"
              element={
                <VoucherList
                  title="My Vouchers"
                  subtitle="Track the status of every voucher you have created."
                  showEmployee={false}
                  emptyText="No vouchers match. Create your first voucher to get started."
                  action={<CreateVoucherButton />}
                />
              }
            />
          </Route>

          {/* Director */}
          <Route element={<ProtectedRoute roles={['DIRECTOR']} />}>
            <Route
              path="/approvals"
              element={
                <VoucherList
                  key="approvals"
                  title="Pending Approvals"
                  subtitle="Vouchers waiting for your decision."
                  fixedFilters={{ status: 'PENDING_APPROVAL' }}
                  showStatusFilter={false}
                  emptyText="Nothing to review — all caught up!"
                />
              }
            />
          </Route>

          {/* Director & Accounts */}
          <Route element={<ProtectedRoute roles={['DIRECTOR', 'ACCOUNTS']} />}>
            <Route
              path="/vouchers"
              element={
                <VoucherList
                  key="all"
                  title="All Vouchers"
                  subtitle="Every submitted voucher across the organisation."
                  statusOptions={REVIEW_STATUSES}
                />
              }
            />
          </Route>

          {/* Employee & Director */}
          <Route element={<ProtectedRoute roles={['EMPLOYEE', 'DIRECTOR']} />}>
            <Route path="/profile" element={<Profile />} />
          </Route>

          <Route
            path="/unauthorized"
            element={<Message title="Access denied" text="Your role does not have access to that page." />}
          />
          <Route path="*" element={<Message title="Page not found" text="The page you requested does not exist." />} />
        </Route>
      </Route>
    </Routes>
  );
}
