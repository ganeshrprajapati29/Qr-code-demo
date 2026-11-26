import { useCallback, useEffect, useState } from 'react';
import { get, put } from '../../api.js';
import { Spinner, ErrorBox, Empty } from '../../ui/bits.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { Parade } from '../reports/Today.jsx';
import { time } from '../../lib/format.js';

export default function Teacher() {
  const [r, setR] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => get('/reports/today').then(setR).catch((e) => setError(e.message)), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);
  if (!r) return error ? <div className="page"><ErrorBox error={error} /></div> : <Spinner />;
  return (
    <div className="page">
      <h1 className="page-title">परेड गिनती</h1>
      <p className="muted">परेड में गिने बच्चों की संख्या डालें। गेट की गिनती से मिलाकर हरा/लाल दिखेगा।</p>
      {r.classes.length === 0 && <Empty title="आपकी कोई क्लास नहीं जुड़ी है">एडमिन से क्लास जुड़वाएँ।</Empty>}
      {r.classes.map((c) => <ClassParade key={c.className} c={c} onSaved={load} />)}
    </div>
  );
}

function ClassParade({ c, onSaved }) {
  const toast = useToast();
  const [count, setCount] = useState(c.parade ? String(c.parade.count) : '');
  const [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    if (count === '') return;
    setBusy(true);
    try {
      await put('/reports/parade', { className: c.className, count: Number(count) });
      toast('परेड गिनती सेव हुई');
      onSaved();
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setBusy(false);
    }
  }
  const n = Number(count) || 0;
  return (
    <div className="card" data-testid={`teacher-${c.className}`}>
      <div className="row between center-v">
        <b className="big">क्लास {c.className}</b>
        <span className="muted">कुल {c.total} · आए {c.present}</span>
      </div>
      <form className="stepper-row" onSubmit={save}>
        <button type="button" className="step-btn" onClick={() => setCount(String(Math.max(0, n - 1)))} aria-label="एक कम">−</button>
        <input className="count-input" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="0" aria-label="परेड गिनती" />
        <button type="button" className="step-btn" onClick={() => setCount(String(n + 1))} aria-label="एक ज़्यादा">+</button>
        <button className="btn btn-primary" disabled={busy || count === ''}>सेव</button>
      </form>
      <Parade c={c} />
      <details className="absent">
        <summary>बच्चों की सूची ({c.students.length})</summary>
        <ul className="mini-list">
          {c.students.map((s) => (
            <li key={s.id}>
              <span>{s.rollNo && <small className="muted">{s.rollNo}. </small>}{s.name}</span>
              <span className={s.state === 'inside' ? 'c-green' : s.state === 'left' ? 'muted' : 'c-red'}>
                {s.state === 'inside' ? `अंदर (${time(s.inAt)})` : s.state === 'left' ? `निकल गया ${time(s.outAt)}` : 'नहीं आया'}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
