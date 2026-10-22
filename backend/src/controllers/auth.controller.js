const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const authService = require('../services/auth.service');
const { validateLogin } = require('../validators/voucher.validator');
const { getSignature } = require('../services/signature.service');

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = validateLogin(req.body);
  const result = await authService.login(email, password);
  res.json({ success: true, data: result });
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: authService.toUserDto(req.user) });
});

exports.uploadMySignature = asyncHandler(async (req, res) => {
  if (!req.file) throw AppError.badRequest('Signature image is required (field name: signature)');
  const user = await authService.saveProfileSignature(req.user, req.file);
  res.json({ success: true, message: 'Signature saved', data: user });
});

exports.getMySignature = asyncHandler(async (req, res) => {
  if (!req.user.signature_id) throw AppError.notFound('No signature saved');
  const sig = await getSignature(req.user.signature_id);
  res.set('Cache-Control', 'private, no-store');
  res.type(sig.mime_type).send(sig.data);
});
