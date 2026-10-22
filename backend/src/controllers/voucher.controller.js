const asyncHandler = require('../utils/asyncHandler');
const voucherService = require('../services/voucher.service');
const dashboardService = require('../services/dashboard.service');
const { validateVoucherInput, validateRejection } = require('../validators/voucher.validator');
const { DEPARTMENTS, EXPENSE_CATEGORIES, STATUS } = require('../utils/constants');

exports.list = asyncHandler(async (req, res) => {
  const result = await voucherService.listVouchers(req.user, req.query);
  res.json({ success: true, ...result });
});

exports.getById = asyncHandler(async (req, res) => {
  const voucher = await voucherService.getVoucherDetails(req.user, req.params.id);
  res.json({ success: true, data: voucher });
});

exports.create = asyncHandler(async (req, res) => {
  const data = validateVoucherInput(req.body);
  const voucher = await voucherService.createVoucher(req.user, data, req.file);
  res.status(201).json({ success: true, message: 'Voucher saved as Draft', data: voucher });
});

exports.update = asyncHandler(async (req, res) => {
  const data = validateVoucherInput(req.body);
  const voucher = await voucherService.updateVoucher(req.user, req.params.id, data, req.file);
  res.json({ success: true, message: 'Draft updated', data: voucher });
});

exports.remove = asyncHandler(async (req, res) => {
  await voucherService.deleteVoucher(req.user, req.params.id);
  res.json({ success: true, message: 'Draft voucher deleted' });
});

exports.submit = asyncHandler(async (req, res) => {
  const voucher = await voucherService.submitVoucher(req.user, req.params.id);
  res.json({ success: true, message: 'Voucher submitted for approval', data: voucher });
});

exports.approve = asyncHandler(async (req, res) => {
  const voucher = await voucherService.approveVoucher(req.user, req.params.id, req.file);
  res.json({ success: true, message: 'Voucher approved', data: voucher });
});

exports.reject = asyncHandler(async (req, res) => {
  const reason = validateRejection(req.body);
  const voucher = await voucherService.rejectVoucher(req.user, req.params.id, reason);
  res.json({ success: true, message: 'Voucher rejected', data: voucher });
});

exports.signature = asyncHandler(async (req, res) => {
  const sig = await voucherService.getVoucherSignature(req.user, req.params.id, req.params.type);
  res.set('Cache-Control', 'private, no-store');
  res.type(sig.mime_type).send(sig.data);
});

exports.dashboard = asyncHandler(async (req, res) => {
  const data = await dashboardService.getDashboard(req.user);
  res.json({ success: true, data });
});

exports.meta = (req, res) => {
  res.json({
    success: true,
    data: { departments: DEPARTMENTS, categories: EXPENSE_CATEGORIES, statuses: Object.values(STATUS) },
  });
};
