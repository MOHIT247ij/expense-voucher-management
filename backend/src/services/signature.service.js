const db = require('../config/db');
const AppError = require('../utils/AppError');

// Magic numbers of the allowed formats – the browser-supplied MIME type alone is not trusted.
function sniffImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/** Stores an uploaded image (multer memory file) and returns its id. */
async function saveSignature(client, file, userId) {
  const mime = sniffImageType(file.buffer);
  if (!mime) throw AppError.badRequest('Signature must be a valid PNG, JPG or WEBP image');
  const { rows } = await client.query(
    'INSERT INTO signatures (mime_type, size_bytes, data, uploaded_by) VALUES ($1, $2, $3, $4) RETURNING id',
    [mime, file.buffer.length, file.buffer, userId]
  );
  return rows[0].id;
}

async function getSignature(id) {
  const { rows } = await db.query('SELECT mime_type, data FROM signatures WHERE id = $1', [id]);
  if (!rows[0]) throw AppError.notFound('Signature not found');
  return rows[0];
}

/** Removes a signature row if nothing references it any more. */
async function deleteIfUnused(client, id) {
  if (!id) return;
  await client.query(
    `DELETE FROM signatures s
      WHERE s.id = $1
        AND NOT EXISTS (SELECT 1 FROM users u WHERE u.signature_id = s.id)
        AND NOT EXISTS (SELECT 1 FROM vouchers v
                         WHERE v.employee_signature_id = s.id OR v.director_signature_id = s.id)`,
    [id]
  );
}

module.exports = { saveSignature, getSignature, deleteIfUnused };
