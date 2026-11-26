const HttpError = require('./httpError');

function str(v, field, { min = 1, max = 100, optional = false } = {}) {
  if (v === undefined || v === null || v === '') {
    if (optional) return '';
    throw new HttpError(400, `${field} भरें`);
  }
  if (typeof v !== 'string') throw new HttpError(400, `${field} सही नहीं है`);
  const s = v.replace(/\s+/g, ' ').trim();
  if (s.length < min) throw new HttpError(400, `${field} कम से कम ${min} अक्षर का हो`);
  if (s.length > max) throw new HttpError(400, `${field} बहुत लंबा है`);
  return s;
}

const CLASS_RE = /^[0-9A-Za-zऀ-ॿ][0-9A-Za-zऀ-ॿ -]{0,11}$/;
function className(v) {
  const s = str(v, 'क्लास', { max: 12 }).toUpperCase();
  if (!CLASS_RE.test(s)) throw new HttpError(400, 'क्लास जैसे 5A, 6-B, Nursery लिखें');
  return s;
}

function int(v, field, { min = 0, max = 100000 } = {}) {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : NaN;
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, `${field} ${min} से ${max} के बीच की संख्या हो`);
  return n;
}

module.exports = { str, className, int };
