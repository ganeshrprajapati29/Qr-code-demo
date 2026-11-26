import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post } from '../../api.js';
import { Spinner, Stat, ErrorBox } from '../../ui/bits.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { todayKey, dayLabel, time } from '../../lib/format.js';

export default function Today() {
  const toast = useToast();
  const [date, setDate] = useState(todayKey());
  const [r, setR] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [rep, al, pk] = await Promise.all([get(`/reports/today?date=${date}`), get('/alerts'), get(`/pickups?from=${todayKey()}&to=${todayKey()}`)]);
      setR(rep);
      setAlerts(al.alerts);
      setOpen(pk.pickups.filter((p) => p.status === 'awaiting_parent' || p.status === 'approved'));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [date]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  async function resolve(id) {
    await post(`/alerts/${id}/resolve`).catch(() => {});
    load();
  }
  async function officeDecision(p, decision) {
    try {
      await post(`/pickups/${p.id}/office-decision`, { decision, note: 'ऑफिस ने फोन पर पुष्टि की' });
      toast(decision === 'yes' ? 'हाँ दर्ज — गार्ड OTP मिलाकर सौंपेगा' : 'मना दर्ज — गार्ड को लाल चेतावनी');
      load();
    } catch (e) {
      toast(e.message, 'err');
    }
  }

  if (!r) return error ? <div className="page"><ErrorBox error={error} onRetry={load} /></div> : <Spinner />;
  const t = r.totals;
  return (
    <div className="page">
      <div className="row between center-v">
        <h1 className="page-title">{date === todayKey() ? 'आज' : dayLabel(date)}</h1>
        <input type="date" className="date-input" value={date} max={todayKey()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="तारीख" />
      </div>

      <div className="stats">
        <Stat label="कुल बच्चे" value={t.total} />
        <Stat label="आए" value={t.present} tone="green" />
        <Stat label="अभी स्कूल में" value={t.inside} tone="blue" />
        <Stat label="निकल गए" value={t.left} />
        <Stat label="नहीं आए" value={t.absent} tone="red" />
      </div>

      {open.length > 0 && (
        <section className="mt">
          <h2 className="section-title">चल रहे पिकअप</h2>
          {open.map((p) => (
            <div key={p.id} className={`card pickup-mini ${p.noResponse ? 'warn' : ''}`}>
              <div className="row gap">
                {p.photoUrl && <img className="picker-thumb sm" src={p.photoUrl} alt="" />}
                <div className="grow">
                  <b>{p.studentName}</b> <span className="muted">({p.className})</span>
                  <div className="tiny">लेने आए: {p.pickerName}{p.relation && ` (${p.relation})`} · {time(p.otpSentAt)}</div>
                  <div className="tiny muted">{p.status === 'approved' ? 'माँ-बाप ने हाँ कहा — OTP का इंतज़ार' : p.noResponse ? '⚠ माँ-बाप ने जवाब नहीं दिया' : 'माँ-बाप के जवाब का इंतज़ार'}</div>
                </div>
              </div>
              {p.status === 'awaiting_parent' && (
                <div className="office-box">
                  <span className="tiny">ऑफिस बैकअप: माँ-बाप को फोन करके पूछें</span>
                  <div className="row gap wrap">
                    {p.guardianPhone && <a className="btn btn-outline btn-sm" href={`tel:${p.guardianPhone}`}>📞 {p.guardianPhone}</a>}
                    <button className="btn btn-green btn-sm" onClick={() => officeDecision(p, 'yes')}>फोन पर हाँ</button>
                    <button className="btn btn-red btn-sm" onClick={() => officeDecision(p, 'no')}>फोन पर मना</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {alerts.length > 0 && (
        <section className="mt">
          <div className="row between center-v">
            <h2 className="section-title">अलर्ट ({alerts.length})</h2>
            <Link to="/alerts" className="link">सब देखें</Link>
          </div>
          {alerts.slice(0, 4).map((a) => (
            <div key={a.id} className="alert alert-red row between center-v">
              <span>{a.text}<small className="block muted">{time(a.createdAt)}</small></span>
              <button className="link" onClick={() => resolve(a.id)}>ठीक है</button>
            </div>
          ))}
        </section>
      )}

      <h2 className="section-title mt-lg">क्लास-वार</h2>
      {r.classes.map((c) => (
        <div key={c.className} className="card class-card" data-testid={`class-${c.className}`}>
          <div className="row between center-v">
            <b className="big">क्लास {c.className}</b>
            <span className="muted">कुल {c.total}</span>
          </div>
          <div className="bar"><i style={{ width: `${c.total ? (c.present / c.total) * 100 : 0}%` }} /></div>
          <div className="row gap wrap tiny">
            <span className="c-green">✔ {c.present} आए</span>
            <span className="c-red">✕ {c.absent} नहीं आए</span>
            <span>अंदर {c.inside}</span>
            <span>निकले {c.left}</span>
          </div>
          <Parade c={c} />
          {c.absentList.length > 0 && (
            <details className="absent">
              <summary>गैरहाज़िर ({c.absentList.length})</summary>
              <p className="c-red">{c.absentList.map((s) => s.name + (s.rollNo ? ` (${s.rollNo})` : '')).join(', ')}</p>
            </details>
          )}
        </div>
      ))}
      {r.classes.length === 0 && <p className="muted">अभी कोई बच्चा नहीं जोड़ा गया।</p>}
    </div>
  );
}

export function Parade({ c }) {
  if (!c.parade) return <div className="parade parade-none">परेड गिनती: अभी नहीं डाली · गेट से अंदर: <b>{c.inside}</b></div>;
  const d = c.parade.diff;
  return (
    <div className={`parade ${c.parade.match ? 'parade-ok' : 'parade-bad'}`} data-testid="parade">
      <span>गेट से अंदर <b>{c.inside}</b> · परेड <b>{c.parade.count}</b></span>
      <b>{c.parade.match ? '✔ सब पूरे हैं' : d < 0 ? `❌ परेड में ${-d} बच्चे कम` : `❌ परेड में ${d} ज़्यादा गिने`}</b>
      <small>{c.parade.byName} · {time(c.parade.at)}</small>
    </div>
  );
}
