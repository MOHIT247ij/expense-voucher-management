import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { voucherApi } from '../api/services';
import VoucherFilters from '../components/VoucherFilters';
import VoucherTable from '../components/VoucherTable';
import Pagination from '../components/Pagination';
import Loader from '../components/Loader';
import { formatCurrency } from '../utils/format';

const FILTER_KEYS = [
  'search', 'status', 'department', 'category', 'employeeName',
  'fromDate', 'toDate', 'minAmount', 'maxAmount', 'sortBy', 'sortOrder', 'page',
];

/**
 * Generic voucher listing used for "My Vouchers", "All Vouchers" and
 * "Pending Approvals". Filters live in the URL so they survive refresh/back.
 */
export default function VoucherList({
  title,
  subtitle,
  fixedFilters = {},
  showEmployee = true,
  showStatusFilter = true,
  statusOptions,
  emptyText = 'No vouchers found.',
  action,
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState({ loading: true, error: '', data: [], pagination: null, summary: null });

  const filters = useMemo(() => {
    const f = {};
    FILTER_KEYS.forEach((k) => {
      const v = searchParams.get(k);
      if (v) f[k] = v;
    });
    return f;
  }, [searchParams]);

  const fixedKey = JSON.stringify(fixedFilters);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const res = await voucherApi.list({ limit: 10, ...filters, ...JSON.parse(fixedKey) });
      setState({ loading: false, error: '', data: res.data, pagination: res.pagination, summary: res.summary });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, [filters, fixedKey]);

  useEffect(() => {
    load();
  }, [load]);

  const updateFilters = (next) => {
    const params = {};
    Object.entries(next).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && !(k === 'page' && Number(v) === 1)) params[k] = String(v);
    });
    setSearchParams(params);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        {action}
      </div>

      <VoucherFilters
        filters={filters}
        onChange={updateFilters}
        showStatus={showStatusFilter}
        showEmployee={showEmployee}
        statusOptions={statusOptions}
      />

      <div className="card">
        {state.error && <div className="alert alert-error">{state.error}</div>}
        {state.loading && !state.data.length ? (
          <Loader />
        ) : state.data.length === 0 ? (
          <div className="empty-state">
            <p>{emptyText}</p>
          </div>
        ) : (
          <>
            {state.summary && (
              <div className="list-summary muted">
                {state.pagination.total} voucher{state.pagination.total === 1 ? '' : 's'} · Total{' '}
                <strong>{formatCurrency(state.summary.totalAmount)}</strong>
              </div>
            )}
            <div className={state.loading ? 'is-refreshing' : ''}>
              <VoucherTable
                vouchers={state.data}
                showEmployee={showEmployee}
                sortBy={filters.sortBy || 'createdAt'}
                sortOrder={filters.sortOrder || 'desc'}
                onSort={(sortBy, sortOrder) => updateFilters({ ...filters, sortBy, sortOrder, page: 1 })}
              />
            </div>
            <Pagination pagination={state.pagination} onPage={(page) => updateFilters({ ...filters, page })} />
          </>
        )}
      </div>
    </div>
  );
}

export const CreateVoucherButton = () => (
  <Link to="/vouchers/new" className="btn btn-primary">
    + Create Voucher
  </Link>
);
