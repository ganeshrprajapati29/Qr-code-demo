const TZ = 'Asia/Kolkata';
export const time = (d) => (d ? new Date(d).toLocaleTimeString('hi-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }) : '');
export const date = (d) => (d ? new Date(d).toLocaleDateString('hi-IN', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' }) : '');
export const dateTime = (d) => (d ? `${date(d)}, ${time(d)}` : '');
export const dayLabel = (key) => (key ? new Date(`${key}T06:00:00Z`).toLocaleDateString('hi-IN', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }) : '');
export const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
export const monthKey = () => todayKey().slice(0, 7);
export const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
export const initial = (name) => [...String(name || '?').trim()][0] || '?';
export const ROLE_LABEL = { admin: 'एडमिन', principal: 'प्रिंसिपल', teacher: 'क्लास टीचर', guard: 'गार्ड' };
export const MSG_STATUS = {
  queued: { label: 'भेजा जा रहा है', tick: '⏳', tone: 'muted' },
  sent: { label: 'भेजा गया', tick: '✓', tone: 'muted' },
  delivered: { label: 'पहुँचा', tick: '✓✓', tone: 'muted' },
  read: { label: 'देख लिया', tick: '✓✓', tone: 'blue' },
  failed: { label: 'नहीं पहुँचा', tick: '✕', tone: 'red' },
};
