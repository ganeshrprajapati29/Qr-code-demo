import { NavLink } from 'react-router-dom';

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="मुख्य मेन्यू">
      <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path fill="currentColor" d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm0 2c-2.3 0-7 1.2-7 3.5V19h7v-2.5c0-.9.4-2.4 2.4-3.4A11 11 0 0 0 8 13Zm8 0c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4Z" />
        </svg>
        <span>ग्राहक</span>
      </NavLink>
      <NavLink to="/scan" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path fill="currentColor" d="M3 3h7v7H3V3Zm2 2v3h3V5H5Zm9-2h7v7h-7V3Zm2 2v3h3V5h-3ZM3 14h7v7H3v-7Zm2 2v3h3v-3H5Zm13-2h3v2h-3v-2Zm-4 0h3v3h-3v-3Zm3 3h2v2h-2v-2Zm2 2h2v2h-2v-2Zm-5 0h3v2h-3v-2Z" />
        </svg>
        <span>QR स्कैन</span>
      </NavLink>
    </nav>
  );
}
