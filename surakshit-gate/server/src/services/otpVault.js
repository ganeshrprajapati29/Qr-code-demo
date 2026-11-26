const crypto = require('crypto');

// The OTP is shown only on the parent's page. It is stored encrypted with a key derived
// from the parent's link token, so only the holder of that link can read it.
function key(token) {
  return crypto.createHash('sha256').update('sg-otp:' + token).digest();
}
function seal(otp, token) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(token), iv);
  const enc = Buffer.concat([c.update(otp, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64url')).join('.');
}
function open(sealed, token) {
  try {
    const [iv, tag, enc] = sealed.split('.').map((s) => Buffer.from(s, 'base64url'));
    const d = crypto.createDecipheriv('aes-256-gcm', key(token), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}
module.exports = { seal, open };
