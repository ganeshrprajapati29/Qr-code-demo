const HttpError = require('../utils/httpError');

// Rejects any "$..." or dotted keys in body/query: blocks NoSQL operator injection globally.
function hasBadKey(v, depth = 0) {
  if (depth > 8 || v === null || typeof v !== 'object') return false;
  if (Array.isArray(v)) return v.some((x) => hasBadKey(x, depth + 1));
  return Object.keys(v).some((k) => k.startsWith('$') || k.includes('.') || hasBadKey(v[k], depth + 1));
}

module.exports = function noOperators(req, res, next) {
  if (hasBadKey(req.body) || hasBadKey(req.query)) return next(new HttpError(400, 'अमान्य अनुरोध', { reason: 'BAD_INPUT' }));
  next();
};
