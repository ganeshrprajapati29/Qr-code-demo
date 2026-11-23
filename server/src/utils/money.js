// All amounts are stored as integer paise to avoid floating point errors.
// ₹10.50 -> 1050

function toPaise(rupees) {
  if (rupees === null || rupees === undefined || rupees === '') return NaN;
  const str = String(rupees).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(str)) return NaN;
  const [whole, frac = ''] = str.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

function toRupees(paise) {
  return Math.round(Number(paise) || 0) / 100;
}

function formatINR(paise) {
  const value = toRupees(paise);
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

module.exports = { toPaise, toRupees, formatINR };
