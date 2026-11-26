import { useEffect, useState } from 'react';
import { get } from '../../api.js';
import { Spinner, ErrorBox, Empty } from '../../ui/bits.jsx';
import { time, date as fmtDate, todayKey } from '../../lib/format.js';

const STATUS = {
  completed: ['सौंपा गया', 'chip-green'], denied: ['माँ-बाप ने मना किया', 'chip-red'], awaiting_parent: ['जवाब का इंतज़ार', 'chip-amber'],
  approved: ['हाँ — OTP बाकी', 'chip-blue'], expired: ['समय खत्म', 'chip-grey'], cancelled: ['रद्द', 'chip-grey'], locked: ['गलत OTP — बंद', 'chip-red'],
};

export default function Pickups() {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(todayKey());
  const [status, setStatus] = useState('');
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setList(null);
    get(`/pickups?from=${from}&to=${to}${status ? `&status=${status}` : ''}`).then((r) => setList(r.pickups)).catch((e) => setError(e.message));
  }, [from, to, status]);
  return (
    <div className="page">
      <h1 className="page-title">पिकअप रिकॉर्ड</h1>
      <div className="row gap wrap">
        <label className="field sm"><span>से</span><input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="field sm"><span>तक</span><input type="date" value={to} max={todayKey()} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      <div className="chips mb">
        {[['', 'सभी'], ['completed', 'सौंपे गए'], ['denied', 'मना किए'], ['locked', 'गलत OTP'], ['expired', 'समय खत्म']].map(([k, l]) => (
          <button key={k} className={status === k ? 'chip-btn on' : 'chip-btn'} onClick={() => setStatus(k)}>{l}</button>
        ))}
      </div>
      <ErrorBox error={error} />
      {!list ? <Spinner /> : list.length === 0 ? <Empty title="कोई पिकअप नहीं" /> : list.map((p) => (
        <div key={p.id} className="card record" data-testid="pickup-record">
          <div className="row gap">
            {p.photoUrl ? <img className="picker-thumb" src={p.photoUrl} alt="लेने वाला" /> : <div className="picker-thumb ph tiny">{p.photoDeleted ? 'फोटो मिटाई गई' : '—'}</div>}
            <div className="grow">
              <div className="row between"><b>{p.studentName}</b><span className={`chip ${STATUS[p.status][1]}`}>{STATUS[p.status][0]}</span></div>
              <div className="muted tiny">क्लास {p.className} · {fmtDate(p.createdAt)}</div>
              <div>लिया: <b>{p.pickerName}</b>{p.relation && ` (${p.relation})`}</div>
            </div>
          </div>
          <dl className="facts">
            <dt>OTP भेजा</dt><dd>{time(p.otpSentAt)}</dd>
            <dt>माँ-बाप ने देखा</dt><dd>{p.linkOpenedAt ? time(p.linkOpenedAt) : '—'}</dd>
            <dt>माँ-बाप का जवाब</dt><dd>{p.decision ? `${p.decision === 'yes' ? 'हाँ' : 'नहीं'} · ${time(p.decisionAt)}${p.decisionBy === 'office' ? ` (ऑफिस: ${p.officeUser})` : ''}` : '—'}</dd>
            <dt>बच्चा निकला</dt><dd>{p.completedAt ? time(p.completedAt) : '—'}</dd>
            <dt>गलत OTP कोशिशें</dt><dd className={p.wrongAttempts ? 'c-red' : ''}>{p.wrongAttempts}</dd>
            <dt>गार्ड</dt><dd>{p.guardName}</dd>
          </dl>
        </div>
      ))}
    </div>
  );
}
