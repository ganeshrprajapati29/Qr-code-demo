// Normalises Indian mobile numbers to 10 digits. Accepts +91 / 91 / 0 prefixes, spaces and dashes.
function normalizePhone(input) {
  let digits = String(input || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

function isValidPhone(phone) {
  return /^[6-9]\d{9}$/.test(phone);
}

module.exports = { normalizePhone, isValidPhone };
