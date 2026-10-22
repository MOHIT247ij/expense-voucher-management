const ROLES = Object.freeze({
  EMPLOYEE: 'EMPLOYEE',
  DIRECTOR: 'DIRECTOR',
  ACCOUNTS: 'ACCOUNTS',
});

const STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

const DEPARTMENTS = Object.freeze([
  'Sales',
  'Marketing',
  'Finance',
  'Human Resources',
  'Information Technology',
  'Operations',
  'Legal',
  'Management',
]);

const EXPENSE_CATEGORIES = Object.freeze([
  'Travel',
  'Food & Meals',
  'Accommodation',
  'Office Supplies',
  'Client Entertainment',
  'Communication',
  'Training',
  'Miscellaneous',
]);

// Columns the client may sort by -> actual SQL column (whitelist prevents SQL injection)
const SORTABLE_COLUMNS = Object.freeze({
  voucherNumber: 'v.voucher_number',
  voucherDate: 'v.voucher_date',
  expenseDate: 'v.expense_date',
  employeeName: 'v.employee_name',
  department: 'v.department',
  category: 'v.expense_category',
  amount: 'v.amount',
  status: 'v.status',
  createdAt: 'v.created_at',
  updatedAt: 'v.updated_at',
});

module.exports = { ROLES, STATUS, DEPARTMENTS, EXPENSE_CATEGORIES, SORTABLE_COLUMNS };
