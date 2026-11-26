import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, can } from '../auth.jsx';
import { post } from '../api.js';
import { useToast } from '../ui/Toast.jsx';
import Modal from '../ui/Modal.jsx';
import { ROLE_LABEL } from '../lib/format.js';

export default function More() {
  const { user, logout } = useAuth();
  const [pw, setPw] = useState(false);
  const items = [
    can(user, 'admin', 'principal') && ['/monthly', '📅', 'महीने की हाज़िरी'],
    can(user, 'admin', 'principal') && ['/pickups', '🧍', 'पिकअप रिकॉर्ड'],
    can(user, 'admin', 'principal') && ['/alerts', '⚠️', 'अलर्ट'],
    can(user, 'admin', 'principal') && ['/messages', '💬', 'मैसेज और डेमो फोन'],
    can(user, 'admin', 'principal') && ['/cards', '🪪', 'QR कार्ड प्रिंट (PDF)'],
    can(user, 'admin', 'principal') && ['/teacher', '📋', 'परेड गिनती'],
    can(user, 'principal') && ['/gate', '🚪', 'गेट स्कैनर'],
    can(user, 'admin') && ['/users', '👥', 'लॉगिन (गार्ड, टीचर, प्रिंसिपल)'],
    can(user, 'admin') && ['/settings', '⚙️', 'सेटिंग, नया सत्र, बैकअप'],
  ].filter(Boolean);
  return (
    <div className="page">
      <h1 className="page-title">और</h1>
      <div className="card profile">
        <b>{user.name}</b>
        <span className="muted">{user.username} · {ROLE_LABEL[user.role]}{user.classes?.length ? ` · क्लास ${user.classes.join(', ')}` : ''}</span>
      </div>
      {items.length > 0 && (
        <ul className="menu">
          {items.map(([to, icon, label]) => (
            <li key={to}><Link to={to}><span aria-hidden="true">{icon}</span>{label}<i aria-hidden="true">›</i></Link></li>
          ))}
        </ul>
      )}
      <ul className="menu">
        <li><button onClick={() => setPw(true)}><span aria-hidden="true">🔑</span>पासवर्ड बदलें<i aria-hidden="true">›</i></button></li>
        <li><button onClick={logout} className="c-red"><span aria-hidden="true">⎋</span>लॉगआउट<i aria-hidden="true">›</i></button></li>
      </ul>
      {pw && <PasswordModal onClose={() => setPw(false)} />}
    </div>
  );
}

function PasswordModal({ onClose }) {
  const toast = useToast();
  const [current, setC] = useState('');
  const [next, setN] = useState('');
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    try {
      await post('/auth/password', { current, next });
      toast('पासवर्ड बदल गया');
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <Modal title="पासवर्ड बदलें" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field"><span>मौजूदा पासवर्ड</span><input type="password" value={current} onChange={(e) => setC(e.target.value)} autoComplete="current-password" /></label>
        <label className="field"><span>नया पासवर्ड (कम से कम 8 अक्षर)</span><input type="password" value={next} onChange={(e) => setN(e.target.value)} autoComplete="new-password" /></label>
        {error && <p className="alert alert-red">{error}</p>}
        <button className="btn btn-primary">सेव करें</button>
      </form>
    </Modal>
  );
}
