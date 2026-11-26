const mongoose = require('mongoose');
const HttpError = require('../utils/httpError');

function notFound(req, res) {
  res.status(404).json({ error: 'यह API मौजूद नहीं है' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...(err.details || {}) });
  if (err instanceof mongoose.Error.ValidationError) return res.status(400).json({ error: 'भरी गई जानकारी सही नहीं है', fields: Object.keys(err.errors) });
  if (err instanceof mongoose.Error.CastError) return res.status(400).json({ error: 'गलत ID' });
  if (err?.code === 11000) {
    const k = Object.keys(err.keyPattern || {})[0];
    return res.status(409).json({ error: k === 'username' ? 'यह यूज़रनेम पहले से है' : 'यह जानकारी पहले से मौजूद है' });
  }
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'गलत JSON' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'फ़ाइल बहुत बड़ी है' });
  console.error(err);
  res.status(500).json({ error: 'सर्वर में दिक्कत आई, दोबारा कोशिश करें' });
}

module.exports = { notFound, errorHandler };
