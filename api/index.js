// Vercel serverless entry point: the whole Express API runs as one function.
// vercel.json rewrites every /api/* request here; req.url keeps the original path.
module.exports = require('../backend/src/app');
