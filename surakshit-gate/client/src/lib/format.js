import { getLang, t } from '../i18n.jsx';

const TZ = 'Asia/Kolkata';
const loc = () => (getLang() === 'en' ? 'en-IN' : 'hi-IN');
export const time = (d) => (d ? new Date(d).toLocaleTimeString(loc(), { timeZone: TZ, hour: 'numeric', minute: '2-digit' }) : '');
export const date = (d) => (d ? new Date(d).toLocaleDateString(loc(), { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' }) : '');
export const dateTime = (d) => (d ? `${date(d)}, ${time(d)}` : '');
export const dayLabel = (key) => (key ? new Date(`${key}T06:00:00Z`).toLocaleDateString(loc(), { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }) : '');
export const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
export const monthKey = () => todayKey().slice(0, 7);
export const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
export const initial = (name) => [...String(name || '?').trim()][0] || '?';
const ROLES = { admin: 'एडमिन', principal: 'प्रिंसिपल', teacher: 'क्लास टीचर', guard: 'गार्ड' };
export const roleLabel = (r) => t(ROLES[r] || r);
export const ROLE_KEYS = Object.keys(ROLES);
const MSG = {
  queued: ['भेजा जा रहा है', '⏳', 'muted'],
  sent: ['भेजा गया', '✓', 'muted'],
  delivered: ['पहुँचा', '✓✓', 'muted'],
  read: ['देख लिया', '✓✓', 'blue'],
  failed: ['नहीं पहुँचा', '✕', 'red'],
};
export const msgStatus = (s) => {
  const [label, tick, tone] = MSG[s] || MSG.queued;
  return { label: t(label), tick, tone };
};
