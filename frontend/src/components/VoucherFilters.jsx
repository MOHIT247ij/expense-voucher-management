import { useEffect, useState } from 'react';
import useMeta from './useMeta';
import { STATUS_LABELS } from '../utils/format';

/**
 * Search + filter bar. `filters` is the current filter object, `onChange`
 * receives the next one. The free-text search is debounced.
 */
export default function VoucherFilters({ filters, onChange, showStatus = true, showEmployee = true, statusOptions }) {
  const { departments, categories, statuses } = useMeta();
  const [search, setSearch] = useState(filters.search || '');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => setSearch(filters.search || ''), [filters.search]);

  useEffect(() => {
    if ((filters.search || '') === search) return undefined;
    const t = setTimeout(() => onChange({ ...filters, search, page: 1 }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const set = (key) => (e) => onChange({ ...filters, [key]: e.target.value, page: 1 });

  const activeCount = ['status', 'department', 'category', 'employeeName', 'fromDate', 'toDate', 'minAmount', 'maxAmount']
    .filter((k) => filters[k]).length;

  const reset = () => {
    setSearch('');
    onChange({ page: 1, sortBy: filters.sortBy, sortOrder: filters.sortOrder });
  };

  return (
    <div className="filters card">
      <div className="filters-row">
        <input
          className="search-input"
          type="search"
          placeholder="Search by voucher no., employee or title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search vouchers"
        />
        <button type="button" className="btn btn-ghost" onClick={() => setExpanded((x) => !x)}>
          Filters{activeCount ? ` (${activeCount})` : ''} {expanded ? '▴' : '▾'}
        </button>
        {(activeCount > 0 || search) && (
          <button type="button" className="btn btn-link" onClick={reset}>
            Clear all
          </button>
        )}
      </div>

      {expanded && (
        <div className="filters-grid">
          {showStatus && (
            <div className="field">
              <label>Status</label>
              <select value={filters.status || ''} onChange={set('status')}>
                <option value="">All statuses</option>
                {(statusOptions || statuses).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          )}
          {showEmployee && (
            <div className="field">
              <label>Employee name</label>
              <input value={filters.employeeName || ''} onChange={set('employeeName')} placeholder="e.g. Amit" />
            </div>
          )}
          <div className="field">
            <label>Department</label>
            <select value={filters.department || ''} onChange={set('department')}>
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Category</label>
            <select value={filters.category || ''} onChange={set('category')}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Expense date from</label>
            <input type="date" value={filters.fromDate || ''} max={filters.toDate || undefined} onChange={set('fromDate')} />
          </div>
          <div className="field">
            <label>Expense date to</label>
            <input type="date" value={filters.toDate || ''} min={filters.fromDate || undefined} onChange={set('toDate')} />
          </div>
          <div className="field">
            <label>Min amount (₹)</label>
            <input type="number" min="0" value={filters.minAmount || ''} onChange={set('minAmount')} />
          </div>
          <div className="field">
            <label>Max amount (₹)</label>
            <input type="number" min="0" value={filters.maxAmount || ''} onChange={set('maxAmount')} />
          </div>
        </div>
      )}
    </div>
  );
}
