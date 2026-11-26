import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { get, post } from '../../api.js';
import { Spinner, ErrorBox, Ticks } from '../../ui/bits.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { beep } from '../../lib/image.js';
import { time, mmss } from '../../lib/format.js';

export default function PickupScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [otp, setOtp] = useState('');
  const [otpMsg, setOtpMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(0);
  const prevStatus = useRef(null);

  const load = useCallback(async () => {
    try {
      const r = await get(`/pickups/${id}`);
      setP(r.pickup);
      setLeft(r.pickup.secondsLeft);
      if (prevStatus.current && prevStatus.current !== r.pickup.status) beep(r.pickup.status === 'approved' || r.pickup.status === 'completed');
      prevStatus.current = r.pickup.status;
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  async function verify(e) {
    e.preventDefault();
    setOtpMsg(null);
    if (!/^\d{4}$/.test(otp)) return setOtpMsg({ bad: true, text: '4 अंक का OTP डालें' });
    setBusy(true);
    try {
      const r = await post(`/pickups/${id}/verify`, { otp });
      setP(r.pickup);
      beep(true);
      toast('बच्चा सौंपा गया — माँ-बाप को मैसेज गया');
    } catch (err) {
      beep(false);
      setOtpMsg({ bad: true, text: err.message });
      load();
    } finally {
      setOtp('');
      setBusy(false);
    }
  }

  async function act(path, msg) {
    setBusy(true);
    try {
      const r = await post(`/pickups/${id}/${path}`);
      setP(r.pickup);
      setLeft(r.pickup.secondsLeft);
      setOtpMsg(null);
      toast(msg);
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  if (!p) return error ? <div className="page"><ErrorBox error={error} /></div> : <Spinner />;
  const m = p.message;
  const showOtp = ['awaiting_parent', 'approved'].includes(p.status);

  return (
    <div className="page pickup">
      <button className="back" onClick={() => navigate('/gate')}>← गेट</button>
      <div className="card">
        <div className="row gap">
          {p.photoUrl ? <img className="picker-thumb" src={p.photoUrl} alt="लेने वाला" /> : <div className="picker-thumb ph">फोटो</div>}
          <div className="grow">
            <div className="muted tiny">बच्चा</div>
            <b className="big">{p.studentName}</b> <span className="muted">· {p.className}</span>
            <div className="muted tiny mt-s">लेने आए</div>
            <b>{p.pickerName}</b>{p.relation && <span className="muted"> ({p.relation})</span>}
          </div>
        </div>
      </div>

      <ol className="timeline" aria-label="स्थिति">
        <Step done label="फोटो और OTP भेजा गया" sub={time(p.otpSentAt)} />
        <Step done={m && ['delivered', 'read'].includes(m.status)} bad={m?.status === 'failed'} label={m?.status === 'failed' ? 'माँ-बाप तक नहीं पहुँचा' : 'माँ-बाप के फोन पर पहुँचा'} sub={m && <Ticks status={m.status} label={false} />} />
        <Step done={Boolean(p.linkOpenedAt) || m?.status === 'read'} label="माँ-बाप ने देख लिया" sub={p.linkOpenedAt && time(p.linkOpenedAt)} />
        <Step done={p.decision === 'yes'} bad={p.decision === 'no'} label={p.decision === 'no' ? 'माँ-बाप ने मना किया' : p.decision === 'yes' ? `माँ-बाप ने हाँ कहा${p.decisionBy === 'office' ? ' (ऑफिस से पुष्टि)' : ''}` : 'माँ-बाप का जवाब'} sub={p.decisionAt ? time(p.decisionAt) : p.status === 'awaiting_parent' ? 'इंतज़ार…' : ''} />
        <Step done={p.status === 'completed'} label="OTP सही — बच्चा सौंपा गया" sub={p.completedAt && time(p.completedAt)} />
      </ol>

      {p.status === 'completed' && (
        <div className="banner banner-green" role="status">
          <b>✓ बच्चा सौंपा गया</b>
          <span>{time(p.completedAt)} पर {p.pickerName} को। माँ-बाप को मैसेज चला गया।</span>
          <button className="btn btn-outline mt" onClick={() => navigate('/gate')}>अगला स्कैन</button>
        </div>
      )}
      {p.status === 'denied' && (
        <div className="banner banner-red" role="alert" data-testid="denied">
          <b>✕ माँ-बाप ने मना किया</b>
          <span>बच्चे को {p.pickerName} को न सौंपें। प्रिंसिपल / ऑफिस को तुरंत बताएँ।</span>
        </div>
      )}
      {p.status === 'locked' && (
        <div className="banner banner-red" role="alert">
          <b>✕ बहुत बार गलत OTP</b>
          <span>पिकअप बंद कर दिया गया। बच्चे को न सौंपें, ऑफिस को बताएँ।</span>
        </div>
      )}
      {p.status === 'expired' && (
        <div className="banner banner-amber" role="alert">
          <b>⏱ समय खत्म हो गया</b>
          <span>पुराना OTP अब नहीं चलेगा। ज़रूरत हो तो नया OTP भेजें।</span>
          <button className="btn btn-primary mt" onClick={() => act('resend', 'नया OTP माँ-बाप को भेजा गया')} disabled={busy}>नया OTP भेजें</button>
        </div>
      )}
      {p.status === 'cancelled' && <div className="banner banner-grey"><b>पिकअप रद्द किया गया</b></div>}

      {p.noResponse && p.status === 'awaiting_parent' && (
        <div className="banner banner-amber" role="alert" data-testid="office-backup">
          <b>माँ-बाप ने {p.parentTimeoutMin} मिनट में जवाब नहीं दिया</b>
          <span>स्कूल ऑफिस से माँ-बाप को फोन करके पुष्टि करवाएँ। ऑफिस “हाँ” दर्ज करेगा तो यहाँ दिख जाएगा।</span>
          {p.officePhone && <a className="btn btn-outline mt" href={`tel:${p.officePhone}`}>📞 ऑफिस को फोन करें ({p.officePhone})</a>}
        </div>
      )}
      {m?.status === 'failed' && showOtp && (
        <div className="banner banner-red"><b>मैसेज माँ-बाप तक नहीं पहुँचा</b><span>नंबर गलत या बंद हो सकता है। ऑफिस से संपर्क करें।</span></div>
      )}

      {showOtp && (
        <form onSubmit={verify} className="card otp-card" data-testid="otp-form">
          <div className="row between center-v">
            <b>लेने वाले से OTP पूछकर डालें</b>
            <span className={`chip ${left < 60 ? 'chip-red' : 'chip-grey'}`}>⏱ {mmss(left)}</span>
          </div>
          <p className="tiny muted">बच्चा तभी सौंपें जब माँ-बाप ने “हाँ” कहा हो <b>और</b> OTP सही निकले। {p.status !== 'approved' && 'अभी माँ-बाप की हाँ नहीं आई है।'}</p>
          <div className="row gap">
            <input className="otp-input" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" autoComplete="one-time-code" placeholder="____" aria-label="OTP" maxLength={4} />
            <button className="btn btn-green" disabled={busy}>OTP जाँचो</button>
          </div>
          {otpMsg && <p className={otpMsg.bad ? 'alert alert-red' : 'alert alert-green'} role="alert">{otpMsg.text}</p>}
          {p.wrongAttempts > 0 && <p className="tiny c-red">गलत कोशिशें: {p.wrongAttempts} (बची: {p.attemptsLeft})</p>}
        </form>
      )}

      {['awaiting_parent', 'approved', 'expired', 'locked'].includes(p.status) && (
        <div className="row gap mt">
          {p.status !== 'expired' && <button className="btn btn-outline grow" onClick={() => act('resend', 'नया OTP और लिंक भेजा गया')} disabled={busy}>नया OTP भेजें</button>}
          <button className="btn btn-ghost-red grow" onClick={() => confirm('यह पिकअप रद्द करें?') && act('cancel', 'पिकअप रद्द')} disabled={busy}>पिकअप रद्द करें</button>
        </div>
      )}
    </div>
  );
}

function Step({ done, bad, label, sub }) {
  return (
    <li className={bad ? 'bad' : done ? 'done' : ''}>
      <i aria-hidden="true">{bad ? '✕' : done ? '✓' : ''}</i>
      <span>{label}</span>
      {sub && <small>{sub}</small>}
    </li>
  );
}
