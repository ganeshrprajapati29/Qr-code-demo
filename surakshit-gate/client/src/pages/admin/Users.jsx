import { useCallback, useEffect, useState } from 'react';
import { get, post, patch } from '../../api.js';
import Modal from '../../ui/Modal.jsx';
import { Spinner, ErrorBox } from '../../ui/bits.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAuth } from '../../auth.jsx';
import { ROLE_LABEL, dateTime } from '../../lib/format.js';

const genPassword = () => {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  const r = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(r, (x) => a[x % a.length]).join('');
};

export default function Users() {
  const [users, setUsers] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = useCallback(() => get('/users').then((r) => setUsers(r.users)), []);
  useEffect(() => { load(); }, [load]);
  if (!users) return <Spinner />;
  return (
    <div className="page">
      <div className="row between center-v">
        <h1 className="page-title">लॉगिन</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setEdit({})}>+ नया लॉगिन</button>
      </div>
      <p className="muted tiny">हर भूमिका को सिर्फ अपना काम दिखता है: गार्ड → गेट, टीचर → अपनी क्लास की परेड, प्रिंसिपल → रिपोर्ट और बच्चे, एडमिन → सब कुछ।</p>
      <ul className="list">
        {users.map((u) => (
          <li key={u.id}>
            <button className="list-row btn-row" onClick={() => setEdit(u)}>
              <div className="grow">
                <b>{u.name}</b> {!u.active && <span className="chip chip-red">बंद</span>}
                <div className="tiny muted">{u.username} · {ROLE_LABEL[u.role]}{u.classes.length ? ` · ${u.classes.join(', ')}` : ''}{u.lastLoginAt && ` · आख़िरी लॉगिन ${dateTime(u.lastLoginAt)}`}</div>
              </div>
              <i className="muted">›</i>
            </button>
          </li>
        ))}
      </ul>
      {edit && <UserForm user={edit.id ? edit : null} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

function UserForm({ user, onClose, onSaved }) {
  const toast = useToast();
  const { user: me } = useAuth();
  const [f, setF] = useState({ name: user?.name || '', username: user?.username || '', role: user?.role || 'guard', classes: user?.classes?.join(', ') || '', password: user ? '' : genPassword() });
  const [error, setError] = useState('');
  const [shown, setShown] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const self = user && user.id === me.id;

  async function save(e) {
    e.preventDefault();
    setError('');
    const classes = f.classes.split(/[,\s]+/).filter(Boolean);
    try {
      if (user) {
        const body = { name: f.name, role: f.role, classes };
        if (f.password) body.password = f.password;
        await patch(`/users/${user.id}`, body);
      } else {
        await post('/users', { ...f, classes });
      }
      if (f.password) setShown(f.password);
      else { toast('सेव हुआ'); onSaved(); }
    } catch (err) {
      setError(err.message);
    }
  }
  async function toggle() {
    try {
      await patch(`/users/${user.id}`, { active: !user.active });
      toast(user.active ? 'लॉगिन बंद किया गया' : 'लॉगिन चालू किया गया');
      onSaved();
    } catch (e) {
      setError(e.message);
    }
  }

  if (shown) {
    return (
      <Modal title="लॉगिन तैयार" onClose={onSaved}>
        <p>यह जानकारी उस व्यक्ति को दें (सिर्फ अभी दिख रही है):</p>
        <div className="card subtle mono">यूज़रनेम: <b>{f.username}</b><br />पासवर्ड: <b>{shown}</b></div>
        <p className="tiny muted">पहले लॉगिन के बाद “और → पासवर्ड बदलें” से पासवर्ड बदलवाएँ।</p>
        <button className="btn btn-primary btn-block" onClick={onSaved}>ठीक है</button>
      </Modal>
    );
  }
  return (
    <Modal title={user ? 'लॉगिन बदलें' : 'नया लॉगिन'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label className="field"><span>नाम</span><input value={f.name} onChange={set('name')} maxLength={60} /></label>
        <label className="field"><span>यूज़रनेम</span><input value={f.username} onChange={set('username')} disabled={Boolean(user)} autoCapitalize="none" placeholder="जैसे guard2" /></label>
        <label className="field"><span>भूमिका</span>
          <select value={f.role} onChange={set('role')} disabled={self}>
            {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        {f.role === 'teacher' && <label className="field"><span>क्लास (कॉमा से अलग, जैसे 5A, 5B)</span><input value={f.classes} onChange={set('classes')} /></label>}
        <label className="field"><span>{user ? 'नया पासवर्ड (बदलना हो तो)' : 'पासवर्ड'}</span>
          <div className="input-affix"><input value={f.password} onChange={set('password')} autoComplete="new-password" /><button type="button" className="link" onClick={() => setF({ ...f, password: genPassword() })}>नया बनाएँ</button></div>
        </label>
        <ErrorBox error={error} />
        <button className="btn btn-primary btn-lg">सेव करें</button>
        {user && !self && <button type="button" className={user.active ? 'btn btn-ghost-red' : 'btn btn-outline'} onClick={toggle}>{user.active ? 'लॉगिन बंद करें' : 'लॉगिन चालू करें'}</button>}
      </form>
    </Modal>
  );
}
