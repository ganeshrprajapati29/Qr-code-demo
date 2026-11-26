import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { roleLabel } from '../lib/format.js';
import { t, LangSwitch } from '../i18n.jsx';

const I = {
  gate: 'M3 5h4v14H3zM17 5h4v14h-4zM9 9h6v2H9zm0 4h6v2H9z',
  today: 'M4 13h4v7H4zm6-6h4v13h-4zm6 3h4v10h-4z',
  kids: 'M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4ZM8 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm0 2c-2.3 0-7 1.2-7 3.5V19h7v-2.5c0-.9.4-2.4 2.4-3.4A11 11 0 0 0 8 13Zm8 0c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4Z',
  parade: 'M9 3h6v2H9zm-4 4h14v14H5zm3 4v2h8v-2zm0 4v2h5v-2z',
  msg: 'M4 4h16v12H7l-3 3z',
  more: 'M5 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  pickup: 'M12 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm-8 18c0-4 4-6 8-6s8 2 8 6v2H4z',
};

export const TABS = {
  guard: [['/gate', 'गेट', 'gate'], ['/more', 'और', 'more']], // labels go through t() when shown
  teacher: [['/teacher', 'परेड', 'parade'], ['/more', 'और', 'more']],
  principal: [['/today', 'आज', 'today'], ['/pickups', 'पिकअप', 'pickup'], ['/students', 'बच्चे', 'kids'], ['/more', 'और', 'more']],
  admin: [['/today', 'आज', 'today'], ['/gate', 'गेट', 'gate'], ['/students', 'बच्चे', 'kids'], ['/messages', 'मैसेज', 'msg'], ['/more', 'और', 'more']],
};
export const HOME = { guard: '/gate', teacher: '/teacher', principal: '/today', admin: '/today' };

export default function Layout() {
  const { user, school } = useAuth();
  const tabs = TABS[user.role];
  return (
    <div className="app">
      <header className="appbar">
        <div className="appbar-brand">
          <img src="/icon.svg" alt="" width="30" height="30" />
          <div>
            <b>{school?.name || t('सुरक्षित गेट')}</b>
            <small>{user.name} · {roleLabel(user.role)}</small>
          </div>
          <LangSwitch className="appbar-lang" />
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <nav className="tabbar" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }} aria-label={t('मुख्य मेन्यू')}>
        {tabs.map(([to, label, icon]) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d={I[icon]} /></svg>
            <span>{t(label)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
