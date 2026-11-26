import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { get, post } from '../../api.js';
import Scanner from '../../ui/Scanner.jsx';
import { Photo, Ticks } from '../../ui/bits.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { beep } from '../../lib/image.js';
import { time } from '../../lib/format.js';

export default function GatePage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [result, setResult] = useState(null); // { ok, data } | { ok:false, error, reason, student }
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState([]);
  const pollRef = useRef();

  const loadRecent = useCallback(() => get('/gate/recent').then((r) => setRecent(r.recent)).catch(() => {}), []);
  useEffect(() => { loadRecent(); }, [loadRecent]);

  // keep the message ticks fresh for ~30 s after a scan
  const watch = useCallback((studentId) => {
    clearInterval(pollRef.current);
    let n = 0;
    pollRef.current = setInterval(async () => {
      if (++n > 15) return clearInterval(pollRef.current);
      try {
        const r = await get(`/gate/students/${studentId}`);
        setResult((cur) => (cur?.ok && cur.data.student.id === studentId ? { ok: true, data: { ...cur.data, ...r } } : cur));
      } catch { /* ignore */ }
    }, 2000);
  }, []);
  useEffect(() => () => clearInterval(pollRef.current), []);

  const onCode = useCallback(async (code) => {
    setBusy(true);
    try {
      const data = await post('/gate/scan', { code });
      beep(true);
      setResult({ ok: true, data, at: Date.now() });
      watch(data.student.id);
      loadRecent();
    } catch (e) {
      beep(false);
      setResult({ ok: false, error: e.message, reason: e.reason, student: e.body?.student, at: Date.now() });
    } finally {
      setBusy(false);
    }
  }, [loadRecent, watch]);

  async function exitWithParent() {
    const id = result.data.student.id;
    setBusy(true);
    try {
      const data = await post('/gate/exit', { studentId: id });
      setResult({ ok: true, data, at: Date.now() });
      toast(`${data.student.name} निकल गए — माँ-बाप को मैसेज गया`);
      watch(id);
      loadRecent();
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page gate">
      <Scanner onCode={onCode} />
      {busy && !result && <p className="muted center mt">जाँच हो रही है…</p>}
      {result && (result.ok ? (
        <ScanCard key={result.at} data={result.data} busy={busy} onExit={exitWithParent}
          onPickup={() => navigate(`/gate/pickup/new/${result.data.student.id}`)}
          onOpenPickup={() => navigate(`/gate/pickup/${result.data.openPickupId}`)} />
      ) : (
        <div key={result.at} className="scan-card bad" role="alert">
          <div className="scan-bad-icon">✕</div>
          {result.student && (
            <div className="row gap center-v">
              <Photo src={result.student.photoUrl} name={result.student.name} size={64} />
              <div><b>{result.student.name}</b><div className="muted">क्लास {result.student.className}</div></div>
            </div>
          )}
          <p className="scan-bad-text">{result.error}</p>
        </div>
      ))}

      {recent.length > 0 && (
        <section className="mt-lg">
          <h2 className="section-title">आज के स्कैन</h2>
          <ul className="list">
            {recent.map((r) => (
              <li key={r.studentId} className="list-row">
                <div className="grow">
                  <b>{r.name}</b> <span className="muted">· {r.className}</span>
                  <div className="tiny muted">आया {time(r.inAt)}{r.outAt ? ` · निकला ${time(r.outAt)}${r.outMode === 'pickup' ? ' (पिकअप)' : ''}` : ''}</div>
                </div>
                <span className={`chip ${r.outAt ? 'chip-grey' : 'chip-green'}`}>{r.outAt ? 'निकल गया' : 'अंदर'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ScanCard({ data, busy, onExit, onPickup, onOpenPickup }) {
  const { student, attendance, event, arrivalMessage, exitMessage, openPickupId } = data;
  const label = event === 'arrived' ? 'स्कूल पहुँचा ✓' : attendance?.outAt ? 'निकल चुका है' : 'स्कूल में है';
  return (
    <div className={`scan-card ${event === 'arrived' ? 'good' : attendance?.outAt ? 'grey' : 'info'}`} data-testid="scan-card">
      <div className="scan-head">
        <Photo src={student.photoUrl} name={student.name} size={112} className="scan-photo" />
        <div className="grow">
          <div className="scan-name" data-testid="scan-name">{student.name}</div>
          <div className="scan-class">क्लास {student.className}{student.rollNo ? ` · रोल ${student.rollNo}` : ''}</div>
          <span className={`chip ${event === 'arrived' ? 'chip-green' : attendance?.outAt ? 'chip-grey' : 'chip-blue'}`}>{label}</span>
        </div>
      </div>
      <p className="tiny muted">फोटो मिलाएँ — फोटो अलग हो तो नकली कार्ड हो सकता है।</p>

      <div className="msg-line">
        <span>आने का मैसेज {attendance && time(attendance.inAt)}</span>
        {arrivalMessage ? <Ticks status={arrivalMessage.status} /> : <span className="muted">—</span>}
      </div>
      {attendance?.outAt && (
        <div className="msg-line">
          <span>निकलने का मैसेज {time(attendance.outAt)}</span>
          {exitMessage ? <Ticks status={exitMessage.status} /> : <span className="muted">{attendance.outMode === 'pickup' ? 'पिकअप से' : '—'}</span>}
        </div>
      )}
      {student.phoneStatus === 'failed' && (
        <p className="alert alert-red">⚠ माँ-बाप का नंबर काम नहीं कर रहा ({student.phoneStatusNote})। ऑफिस को बताएँ।</p>
      )}

      {event === 'arrived' && <p className="tiny muted center">छुट्टी के समय कार्ड दोबारा स्कैन करें — तब निकलने के बटन आएँगे।</p>}
      {!attendance?.outAt && event !== 'arrived' && (
        openPickupId ? (
          <button className="btn btn-blue btn-lg mt" onClick={onOpenPickup}>चल रहा पिकअप खोलें →</button>
        ) : (
          <div className="exit-actions">
            <button className="btn btn-green btn-lg" onClick={onExit} disabled={busy}>बच्चा निकला (माँ-बाप के साथ)</button>
            <button className="btn btn-blue btn-lg" onClick={onPickup} disabled={busy}>कोई और लेने आया है</button>
          </div>
        )
      )}
      {attendance?.outAt && <Link to="/gate" className="tiny muted">अगला कार्ड स्कैन करें</Link>}
    </div>
  );
}
