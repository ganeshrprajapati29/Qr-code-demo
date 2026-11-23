export function rupees(value) {
  const v = Math.abs(Number(value) || 0);
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
}

export function shortDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('hi-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function relativeDay(d) {
  if (!d) return '';
  const date = new Date(d);
  const today = new Date();
  const diff = Math.floor((new Date(today.toDateString()) - new Date(date.toDateString())) / 86400000);
  if (diff === 0) return 'आज';
  if (diff === 1) return 'कल';
  if (diff < 30) return `${diff} दिन पहले`;
  return shortDate(d);
}

export function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function balanceInfo(balance) {
  if (balance > 0) return { label: 'बाक़ी है', tone: 'due' };
  if (balance < 0) return { label: 'एडवांस', tone: 'adv' };
  return { label: 'हिसाब बराबर', tone: 'zero' };
}

export function initials(name) {
  const clean = String(name || '').replace(/\(.*?\)/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}
