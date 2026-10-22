const multer = require('multer');
const { upload: uploadConfig } = require('../config/env');
const AppError = require('../utils/AppError');

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

// Files are kept in memory and then stored in PostgreSQL (see signature.service.js),
// so nothing depends on the server's local disk.
const signatureUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: uploadConfig.maxFileSizeBytes, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(AppError.badRequest('Signature must be a PNG, JPG or WEBP image'));
    }
    cb(null, true);
  },
});

module.exports = { signatureUpload };
