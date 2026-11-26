const config = require('../config');

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: config.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('en-IN', { timeZone: config.timeZone, hour: 'numeric', minute: '2-digit', hour12: true });

// 'YYYY-MM-DD' in India time
const dayKey = (d = new Date()) => dayFmt.format(d);
// '8:05 am'
const clock = (d = new Date()) => timeFmt.format(d).replace(/\s?(am|pm)$/i, (m) => ' ' + m.trim().toLowerCase());

function isDayKey(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}
function isMonthKey(s) {
  return typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}
const minutes = (n) => n * 60 * 1000;

module.exports = { dayKey, clock, isDayKey, isMonthKey, minutes };
