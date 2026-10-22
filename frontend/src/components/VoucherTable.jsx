import { useNavigate } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import { formatCurrency, formatDate } from '../utils/format';

const COLUMNS = [
  { key: 'voucherNumber', label: 'Voucher No.' },
  { key: 'expenseDate', label: 'Expense Date' },
  { key: 'employeeName', label: 'Employee', employeeOnly: true },
  { key: 'department', label: 'Department' },
  { key: 'expenseTitle', label: 'Title', sortable: false },
  { key: 'category', label: 'Category' },
  { key: 'amount', label: 'Amount', align: 'right' },
  { key: 'status', label: 'Status' },
];

/** Sortable voucher table; becomes stacked cards on small screens. */
export default function VoucherTable({ vouchers, sortBy, sortOrder, onSort, showEmployee = true }) {
  const navigate = useNavigate();
  const columns = COLUMNS.filter((c) => showEmployee || !c.employeeOnly);

  const header = (col) => {
    if (col.sortable === false || !onSort) return col.label;
    const active = sortBy === col.key;
    const nextOrder = active && sortOrder === 'asc' ? 'desc' : 'asc';
    return (
      <button type="button" className={`sort-btn ${active ? 'active' : ''}`} onClick={() => onSort(col.key, nextOrder)}>
        {col.label}
        <span aria-hidden="true">{active ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ' ↕'}</span>
      </button>
    );
  };

  const cell = (v, key) => {
    switch (key) {
      case 'voucherNumber':
        return <strong className="mono">{v.voucherNumber}</strong>;
      case 'expenseDate':
        return formatDate(v.expenseDate);
      case 'category':
        return v.expenseCategory;
      case 'amount':
        return formatCurrency(v.amount);
      case 'status':
        return <StatusBadge status={v.status} />;
      default:
        return v[key];
    }
  };

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.align === 'right' ? 'right' : ''}>
                {header(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vouchers.map((v) => (
            <tr
              key={v.id}
              tabIndex={0}
              onClick={() => navigate(`/vouchers/${v.id}`)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/vouchers/${v.id}`)}
            >
              {columns.map((c) => (
                <td key={c.key} data-label={c.label} className={c.align === 'right' ? 'right' : ''}>
                  {cell(v, c.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
