const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { authenticate, authorize } = require('../middleware/auth');
const { signatureUpload } = require('../middleware/upload');
const auth = require('../controllers/auth.controller');
const vouchers = require('../controllers/voucher.controller');
const { ROLES } = require('../utils/constants');

const router = express.Router();
const { EMPLOYEE, DIRECTOR } = ROLES;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
});

// ---------- Health ----------
router.get('/health', (req, res) => res.json({ success: true, status: 'ok' }));

// ---------- Auth ----------
router.post('/auth/login', loginLimiter, auth.login);
router.get('/auth/me', authenticate, auth.me);

// ---------- Profile signature (Employee & Director) ----------
router.post(
  '/users/me/signature',
  authenticate,
  authorize(EMPLOYEE, DIRECTOR),
  signatureUpload.single('signature'),
  auth.uploadMySignature
);
router.get('/users/me/signature', authenticate, auth.getMySignature);

// ---------- Lookups & dashboard ----------
router.get('/meta', authenticate, vouchers.meta);
router.get('/dashboard', authenticate, vouchers.dashboard);

// ---------- Vouchers ----------
router.get('/vouchers', authenticate, vouchers.list);
router.get('/vouchers/:id', authenticate, vouchers.getById);
router.get('/vouchers/:id/signatures/:type', authenticate, vouchers.signature);

// Employee only
router.post('/vouchers', authenticate, authorize(EMPLOYEE), signatureUpload.single('employeeSignature'), vouchers.create);
router.put('/vouchers/:id', authenticate, authorize(EMPLOYEE), signatureUpload.single('employeeSignature'), vouchers.update);
router.delete('/vouchers/:id', authenticate, authorize(EMPLOYEE), vouchers.remove);
router.post('/vouchers/:id/submit', authenticate, authorize(EMPLOYEE), vouchers.submit);

// Director only (Accounts has read-only access through the GET routes above)
router.post('/vouchers/:id/approve', authenticate, authorize(DIRECTOR), signatureUpload.single('directorSignature'), vouchers.approve);
router.post('/vouchers/:id/reject', authenticate, authorize(DIRECTOR), vouchers.reject);


module.exports = router;
