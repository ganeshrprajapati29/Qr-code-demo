function normalizePhone(input) {
  let d = String(input ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}
const isValidPhone = (p) => /^[6-9]\d{9}$/.test(p);
const maskPhone = (p) => (p ? `${p.slice(0, 2)}xxxxx${p.slice(-3)}` : '');
module.exports = { normalizePhone, isValidPhone, maskPhone };
