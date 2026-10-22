const AppError = require('../utils/AppError');
const { DEPARTMENTS, EXPENSE_CATEGORIES } = require('../utils/constants');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AMOUNT = 10000000; // 1 crore – sanity upper bound for a single voucher

function isValidDate(value) {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function todayISO() {
  // Local date of the server, in YYYY-MM-DD
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now - offset).toISOString().slice(0, 10);
}

const str = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());

/**
 * Validates and normalises voucher fields coming from JSON or multipart bodies.
 * Throws AppError(400) with a field -> message map when invalid.
 */
function validateVoucherInput(body = {}) {
  const errors = {};

  const department = str(body.department);
  const expenseTitle = str(body.expenseTitle);
  const expenseCategory = str(body.expenseCategory);
  const expenseDescription = str(body.expenseDescription);
  const expenseDate = str(body.expenseDate);
  const amountRaw = str(body.amount);

  if (!department) errors.department = 'Department is required';
  else if (!DEPARTMENTS.includes(department)) errors.department = 'Invalid department';

  if (!expenseTitle) errors.expenseTitle = 'Expense title is required';
  else if (expenseTitle.length > 150) errors.expenseTitle = 'Expense title must be at most 150 characters';

  if (!expenseCategory) errors.expenseCategory = 'Expense category is required';
  else if (!EXPENSE_CATEGORIES.includes(expenseCategory)) errors.expenseCategory = 'Invalid expense category';

  if (expenseDescription.length > 2000) {
    errors.expenseDescription = 'Description must be at most 2000 characters';
  }

  if (!expenseDate) errors.expenseDate = 'Expense date is required';
  else if (!isValidDate(expenseDate)) errors.expenseDate = 'Expense date must be a valid date (YYYY-MM-DD)';
  else if (expenseDate > todayISO()) errors.expenseDate = 'Expense date cannot be in the future';

  let amount;
  if (amountRaw === '') {
    errors.amount = 'Amount is required';
  } else {
    amount = Number(amountRaw);
    if (!Number.isFinite(amount)) errors.amount = 'Amount must be a number';
    else if (amount <= 0) errors.amount = 'Amount must be greater than zero';
    else if (amount > MAX_AMOUNT) errors.amount = `Amount cannot exceed ${MAX_AMOUNT}`;
    else if (!/^\d+(\.\d{1,2})?$/.test(amountRaw)) errors.amount = 'Amount can have at most 2 decimal places';
  }

  if (Object.keys(errors).length) {
    throw AppError.badRequest('Validation failed', errors);
  }

  return {
    department,
    expenseTitle,
    expenseCategory,
    expenseDescription: expenseDescription || null,
    expenseDate,
    amount,
  };
}

function validateRejection(body = {}) {
  const reason = str(body.reason);
  if (!reason) throw AppError.badRequest('Validation failed', { reason: 'Rejection reason is required' });
  if (reason.length < 5) {
    throw AppError.badRequest('Validation failed', { reason: 'Rejection reason must be at least 5 characters' });
  }
  if (reason.length > 1000) {
    throw AppError.badRequest('Validation failed', { reason: 'Rejection reason must be at most 1000 characters' });
  }
  return reason;
}

function validateLogin(body = {}) {
  const email = str(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const errors = {};
  if (!email) errors.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email';
  if (!password) errors.password = 'Password is required';
  if (Object.keys(errors).length) throw AppError.badRequest('Validation failed', errors);
  return { email, password };
}

module.exports = { validateVoucherInput, validateRejection, validateLogin, isValidDate };
