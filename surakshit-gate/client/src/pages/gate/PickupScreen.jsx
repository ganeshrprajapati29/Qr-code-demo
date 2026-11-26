import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { get, post } from '../../api.js';
import { Spinner, ErrorBox, Ticks } from '../../ui/bits.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { beep } from '../../lib/image.js';
import { time, mmss } from '../../lib/format.js';
import { t } from '../../i18n.jsx';

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
    if (!/^\d{4}$/.test(otp)) return setOtpMsg({ bad: true, text: t('4 अंक का OTP डालें') });
    setBusy(true);
    try {
      const r = await post(`/pickups/${id}/verify`, { otp });
      setP(r.pickup);
      beep(true);
      toast(t('बच्चा सौंपा गया — माँ-बाप को मैसेज गया'));
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
      <button className="back" onClick={() => navigate('/gate')}>{t('← गेट')}</button>
      <div className="card">
        <div className="row gap">
          {p.photoUrl ? <img className="picker-thumb" src={p.photoUrl} alt={t('लेने वाला')} /> : <div className="picker-thumb ph">{t('फोटो')}</div>}
          <div className="grow">
            <div className="muted tiny">{t('बच्चा')}</div>
            <b className="big">{p.studentName}</b> <span className="muted">· {p.className}</span>
            <div className="muted tiny mt-s">{t('लेने आए')}</div>
            <b>{p.pickerName}</b>{p.relation && <span className="muted"> ({p.relation})</span>}
          </div>
        </div>
      </div>

      <ol className="timeline" aria-label={t('स्थिति')}>
        <Step done label={t('फोटो और OTP भेजा गया')} sub={time(p.otpSentAt)} />
        <Step done={m && ['delivered', 'read'].includes(m.status)} bad={m?.status === 'failed'} label={m?.status === 'failed' ? t('माँ-बाप तक नहीं पहुँचा') : t('माँ-बाप के फोन पर पहुँचा')} sub={m && <Ticks status={m.status} label={false} />} />
        <Step done={Boolean(p.linkOpenedAt) || m?.status === 'read'} label={t('माँ-बाप ने देख लिया')} sub={p.linkOpenedAt && time(p.linkOpenedAt)} />
        <Step done={p.decision === 'yes'} bad={p.decision === 'no'} label={p.decision === 'no' ? t('माँ-बाप ने मना किया') : p.decision === 'yes' ? t('माँ-बाप ने हाँ कहा') + (p.decisionBy === 'office' ? ` (${t('ऑफिस से पुष्टि')})` : '') : t('माँ-बाप का जवाब')} sub={p.decisionAt ? time(p.decisionAt) : p.status === 'awaiting_parent' ? t('इंतज़ार…') : ''} />
        <Step done={p.status === 'completed'} label={t('OTP सही — बच्चा सौंपा गया')} sub={p.completedAt && time(p.completedAt)} />
      </ol>

      {p.status === 'completed' && (
        <div className="banner banner-green" role="status">
          <b>{t('✓ बच्चा सौंपा गया')}</b>
          <span>{t('{time} पर {name} को। माँ-बाप को मैसेज चला गया।', { time: time(p.completedAt), name: p.pickerName })}</span>
          <button className="btn btn-outline mt" onClick={() => navigate('/gate')}>{t('अगला स्कैन')}</button>
        </div>
      )}
      {p.status === 'denied' && (
        <div className="banner banner-red" role="alert" data-testid="denied">
          <b>{t('✕ माँ-बाप ने मना किया')}</b>
          <span>{t('बच्चे को {name} को न सौंपें। प्रिंसिपल / ऑफिस को तुरंत बताएँ।', { name: p.pickerName })}</span>
        </div>
      )}
      {p.status === 'locked' && (
        <div className="banner banner-red" role="alert">
          <b>{t('✕ बहुत बार गलत OTP')}</b>
          <span>{t('पिकअप बंद कर दिया गया। बच्चे को न सौंपें, ऑफिस को बताएँ।')}</span>
        </div>
      )}
      {p.status === 'expired' && (
        <div className="banner banner-amber" role="alert">
          <b>{t('⏱ समय खत्म हो गया')}</b>
          <span>{t('पुराना OTP अब नहीं चलेगा। ज़रूरत हो तो नया OTP भेजें।')}</span>
          <button className="btn btn-primary mt" onClick={() => act('resend', t('नया OTP माँ-बाप को भेजा गया'))} disabled={busy}>{t('नया OTP भेजें')}</button>
        </div>
      )}
      {p.status === 'cancelled' && <div className="banner banner-grey"><b>{t('पिकअप रद्द किया गया')}</b></div>}

      {p.noResponse && p.status === 'awaiting_parent' && (
        <div className="banner banner-amber" role="alert" data-testid="office-backup">
          <b>{t('माँ-बाप ने {n} मिनट में जवाब नहीं दिया', { n: p.parentTimeoutMin })}</b>
          <span>{t('स्कूल ऑफिस से माँ-बाप को फोन करके पुष्टि करवाएँ। ऑफिस “हाँ” दर्ज करेगा तो यहाँ दिख जाएगा।')}</span>
          {p.officePhone && <a className="btn btn-outline mt" href={`tel:${p.officePhone}`}>📞 {t('ऑफिस को फोन करें')} ({p.officePhone})</a>}
        </div>
      )}
      {m?.status === 'failed' && showOtp && (
        <div className="banner banner-red"><b>{t('मैसेज माँ-बाप तक नहीं पहुँचा')}</b><span>{t('नंबर गलत या बंद हो सकता है। ऑफिस से संपर्क करें।')}</span></div>
      )}

      {showOtp && (
        <form onSubmit={verify} className="card otp-card" data-testid="otp-form">
          <div className="row between center-v">
            <b>{t('लेने वाले से OTP पूछकर डालें')}</b>
            <span className={`chip ${left < 60 ? 'chip-red' : 'chip-grey'}`}>⏱ {mmss(left)}</span>
          </div>
          <p className="tiny muted">{t('बच्चा तभी सौंपें जब माँ-बाप ने “हाँ” कहा हो और OTP सही निकले।')} {p.status !== 'approved' && t('अभी माँ-बाप की हाँ नहीं आई है।')}</p>
          <div className="row gap">
            <input className="otp-input" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" autoComplete="one-time-code" placeholder="____" aria-label="OTP" maxLength={4} />
            <button className="btn btn-green" disabled={busy}>{t('OTP जाँचो')}</button>
          </div>
          {otpMsg && <p className={otpMsg.bad ? 'alert alert-red' : 'alert alert-green'} role="alert">{otpMsg.text}</p>}
          {p.wrongAttempts > 0 && <p className="tiny c-red">{t('गलत कोशिशें: {n} (बची: {left})', { n: p.wrongAttempts, left: p.attemptsLeft })}</p>}
        </form>
      )}

      {['awaiting_parent', 'approved', 'expired', 'locked'].includes(p.status) && (
        <div className="row gap mt">
          {p.status !== 'expired' && <button className="btn btn-outline grow" onClick={() => act('resend', t('नया OTP और लिंक भेजा गया'))} disabled={busy}>{t('नया OTP भेजें')}</button>}
          <button className="btn btn-ghost-red grow" onClick={() => confirm(t('यह पिकअप रद्द करें?')) && act('cancel', t('पिकअप रद्द'))} disabled={busy}>{t('पिकअप रद्द करें')}</button>
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
