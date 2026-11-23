const mongoose = require('mongoose');
const HttpError = require('../utils/httpError');

function notFound(req, res) {
  res.status(404).json({ error: 'यह API मौजूद नहीं है' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...(err.details || {}) });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ error: 'भरी गई जानकारी सही नहीं है', fields: Object.keys(err.errors) });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: 'ग़लत ID' });
  }
  if (err && err.code === 11000) {
    return res.status(409).json({ error: 'इस फ़ोन नंबर से ग्राहक पहले से जुड़ा है' });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'ग़लत JSON' });
  }
  console.error(err);
  return res.status(500).json({ error: 'सर्वर में कोई दिक़्क़त आई, दोबारा कोशिश करें' });
}

module.exports = { notFound, errorHandler };
