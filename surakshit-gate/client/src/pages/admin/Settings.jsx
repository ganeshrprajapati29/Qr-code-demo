import { useCallback, useEffect, useState } from 'react';
import { get, post, put } from '../../api.js';
import { Spinner, ErrorBox } from '../../ui/bits.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { useAuth } from '../../auth.jsx';
import { dateTime } from '../../lib/format.js';

export default function Settings() {
  const toast = useToast();
  const { refresh } = useAuth();
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { get('/admin/settings').then((r) => setS(r.settings)); }, []);
  if (!s) return <Spinner />;
  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });
  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      const r = await put('/admin/settings', {
        schoolName: s.schoolName, officePhone: s.officePhone, otpTtlMin: Number(s.otpTtlMin), parentTimeoutMin: Number(s.parentTimeoutMin),
        pickupPhotoRetentionDays: Number(s.pickupPhotoRetentionDays), backupHour: Number(s.backupHour),
      });
      setS(r.settings);
      refresh();
      toast('सेटिंग सेव हुई');
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <div className="page">
      <h1 className="page-title">सेटिंग</h1>
      <form className="card form" onSubmit={save}>
        <label className="field"><span>स्कूल का नाम</span><input value={s.schoolName} onChange={set('schoolName')} /></label>
        <label className="field"><span>स्कूल ऑफिस का फोन (पिकअप बैकअप के लिए)</span><input value={s.officePhone} onChange={set('officePhone')} inputMode="tel" /></label>
        <div className="row-2">
          <label className="field"><span>OTP कितने मिनट चले (5–10)</span><input type="number" min="5" max="10" value={s.otpTtlMin} onChange={set('otpTtlMin')} /></label>
          <label className="field"><span>माँ-बाप जवाब न दें तो कितने मिनट बाद ऑफिस बैकअप</span><input type="number" min="2" max="10" value={s.parentTimeoutMin} onChange={set('parentTimeoutMin')} /></label>
        </div>
        <div className="row-2">
          <label className="field"><span>लेने वालों की फोटो कितने दिन बाद मिटे</span><input type="number" min="1" max="365" value={s.pickupPhotoRetentionDays} onChange={set('pickupPhotoRetentionDays')} /></label>
          <label className="field"><span>रोज़ का बैकअप (घंटा, 0–23)</span><input type="number" min="0" max="23" value={s.backupHour} onChange={set('backupHour')} /></label>
        </div>
        <p className="tiny muted">मैसेज का तरीका: <b>{s.messageProvider === 'whatsapp' ? 'WhatsApp Cloud API' : 'डेमो (असली मैसेज नहीं जाते)'}</b> · सत्र: {s.sessionName}</p>
        <ErrorBox error={error} />
        <button className="btn btn-primary">सेव करें</button>
      </form>
      <NewSession current={s.sessionName} />
      <Backups lastBackupAt={s.lastBackupAt} />
      <AuditLog />
    </div>
  );
}

function NewSession({ current }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [classes, setClasses] = useState([]);
  const [rows, setRows] = useState({});
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) get('/students/classes').then((r) => { setClasses(r.classes); setRows(Object.fromEntries(r.classes.map((c) => [c.className, { to: '', remove: false }]))); });
  }, [open]);
  async function run() {
    setError('');
    const moves = Object.entries(rows).filter(([, v]) => v.to && !v.remove).map(([from, v]) => ({ from, to: v.to }));
    const removeClasses = Object.entries(rows).filter(([, v]) => v.remove).map(([k]) => k);
    if (!confirm(`नया सत्र “${name}”: ${moves.length} क्लास आगे बढ़ेंगी, ${removeClasses.length} क्लास के बच्चे हटेंगे। पहले अपने आप बैकअप बनेगा। आगे बढ़ें?`)) return;
    try {
      const r = await post('/admin/new-session', { sessionName: name, moves, removeClasses });
      toast(`सत्र ${r.sessionName}: ${r.moved} बच्चे आगे बढ़े, ${r.removed} हटे`);
      setOpen(false);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <section className="card mt">
      <div className="row between center-v"><b>नया सत्र शुरू करें</b><span className="muted tiny">अभी: {current}</span></div>
      {!open ? <button className="btn btn-outline btn-sm mt-s" onClick={() => setOpen(true)}>शुरू करें</button> : (
        <div className="form mt-s">
          <label className="field"><span>नए सत्र का नाम</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="जैसे 2027-28" /></label>
          <p className="tiny muted">हर क्लास के आगे नई क्लास लिखें (जैसे 5A → 6A), या पास-आउट क्लास को “हटाएँ” चुनें। खाली छोड़ी क्लास वैसी ही रहेगी।</p>
          {classes.map((c) => (
            <div key={c.className} className="row gap center-v session-row">
              <b className="w-cls">{c.className}</b><span className="muted tiny">({c.count})</span><span>→</span>
              <input value={rows[c.className]?.to || ''} disabled={rows[c.className]?.remove} onChange={(e) => setRows({ ...rows, [c.className]: { ...rows[c.className], to: e.target.value } })} placeholder="नई क्लास" />
              <label className="tiny row center-v"><input type="checkbox" checked={rows[c.className]?.remove || false} onChange={(e) => setRows({ ...rows, [c.className]: { to: '', remove: e.target.checked } })} /> हटाएँ</label>
            </div>
          ))}
          <ErrorBox error={error} />
          <button className="btn btn-primary" onClick={run} disabled={name.length < 4}>नया सत्र लागू करें</button>
        </div>
      )}
    </section>
  );
}

function Backups({ lastBackupAt }) {
  const toast = useToast();
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => get('/admin/backups').then((r) => setList(r.backups)), []);
  useEffect(() => { load(); }, [load]);
  async function create() {
    setBusy(true);
    try {
      await post('/admin/backups');
      toast('बैकअप बन गया');
      load();
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }
  async function restore(name) {
    const typed = prompt(`“${name}” से पूरा डेटा वापस लाने के लिए RESTORE लिखें।\nअभी का डेटा पहले अपने आप बैकअप में सेव होगा।`);
    if (typed !== 'RESTORE') return;
    setBusy(true);
    try {
      const r = await post('/admin/backups/restore', { name, confirm: 'RESTORE' });
      toast(`डेटा वापस आ गया (${r.counts.students} बच्चे)`);
      setTimeout(() => location.reload(), 1200);
    } catch (e) {
      toast(e.message, 'err');
      setBusy(false);
    }
  }
  const kb = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`);
  return (
    <section className="card mt">
      <div className="row between center-v"><b>बैकअप</b><button className="btn btn-outline btn-sm" onClick={create} disabled={busy}>अभी बैकअप लें</button></div>
      <p className="tiny muted">रोज़ अपने आप बैकअप बनता है (पिछले 14 रखे जाते हैं)। आख़िरी अपने-आप बैकअप: {lastBackupAt ? dateTime(lastBackupAt) : 'अभी नहीं'}</p>
      {!list ? <Spinner /> : (
        <ul className="mini-list">
          {list.map((b) => (
            <li key={b.name}>
              <span>{dateTime(b.createdAt)} <small className="muted">· {b.name.split('_').slice(2).join(' ') || 'auto'} · {b.counts.students ?? 0} बच्चे · {kb(b.bytes)}</small></span>
              <button className="link" onClick={() => restore(b.name)} disabled={busy}>वापस लाएँ</button>
            </li>
          ))}
          {list.length === 0 && <li className="muted">अभी कोई बैकअप नहीं</li>}
        </ul>
      )}
    </section>
  );
}

function AuditLog() {
  const [rows, setRows] = useState(null);
  return (
    <section className="card mt">
      <div className="row between center-v"><b>बदलाव का रिकॉर्ड</b>{!rows && <button className="btn btn-outline btn-sm" onClick={() => get('/admin/audit').then((r) => setRows(r.audit))}>देखें</button>}</div>
      {rows && <ul className="mini-list">{rows.map((a, i) => <li key={i}><span>{a.action} <small className="muted">{a.detail}</small></span><small className="muted">{a.user} · {dateTime(a.at)}</small></li>)}</ul>}
    </section>
  );
}
