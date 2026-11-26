import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { Spinner } from '../../ui/bits.jsx';
import { time, mmss } from '../../lib/format.js';
import { t, useLang, LangSwitch } from '../../i18n.jsx';

export default function ParentPage() {
  const { token } = useParams();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(0);
  const [confirmNo, setConfirmNo] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api(`/public/pickup/${token}`);
      setD(r);
      setLeft(r.secondsLeft);
    } catch (e) {
      setError(e.message);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  const { lang, setLang } = useLang();
  useEffect(() => {
    if (!d) return;
    try {
      if (sessionStorage.getItem('sg-parent-lang')) return;
      sessionStorage.setItem('sg-parent-lang', '1');
    } catch { return; }
    if (d.lang && d.lang !== lang) setLang(d.lang);
  }, [d, lang, setLang]);
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => {
      if (s === 1) load();
      return Math.max(0, s - 1);
    }), 1000);
    return () => clearInterval(t);
  }, [load]);

  async function decide(decision) {
    setBusy(true);
    try {
      await api(`/public/pickup/${token}/decision`, { method: 'POST', body: { decision } });
      await load();
    } catch (e) {
      setError(e.message);
      load();
    } finally {
      setBusy(false);
      setConfirmNo(false);
    }
  }

  if (!d && !error) return <Spinner label={t('खुल रहा है…')} />;
  if (!d) {
    return (
      <div className="parent">
        <div className="parent-card center">
          <div className="big-icon">🔒</div>
          <h1>{t('लिंक नहीं खुला')}</h1>
          <p>{error}</p>
          <p className="muted">{t('हर पिकअप का लिंक अलग होता है और कुछ मिनट में खत्म हो जाता है।')}</p>
        </div>
      </div>
    );
  }

  const live = ['awaiting_parent', 'approved'].includes(d.status);
  return (
    <div className="parent">
      <header className="parent-head">
        <img src="/icon.svg" alt="" width="32" height="32" />
        <div className="grow"><b>{d.school}</b><small>{t('सुरक्षित पिकअप')}</small></div>
        <LangSwitch className="appbar-lang" />
      </header>

      <div className="parent-card">
        <div className="parent-child">
          {d.studentPhotoUrl && <img src={d.studentPhotoUrl} alt={d.studentName} />}
          <div>
            <small className="muted">{t('आपका बच्चा')}</small>
            <b>{d.studentName}</b>
            <span className="muted">{t('क्लास')} {d.className}</span>
          </div>
        </div>

        <h1 className="parent-q">{d.status === 'awaiting_parent' ? t('कोई आपके बच्चे को लेने आया है') : t('लेने आए व्यक्ति')}</h1>
        <div className="picker-big">
          {d.pickerPhotoUrl ? <img src={d.pickerPhotoUrl} alt={t('लेने आए व्यक्ति की फोटो')} /> : <div className="ph">{t('फोटो उपलब्ध नहीं')}</div>}
          <div className="picker-meta">
            <b>{d.pickerName}</b>
            {d.relation && <span>{t('रिश्ता')}: {d.relation}</span>}
            <small className="muted">{t('गेट पर {time}', { time: time(d.requestedAt) })}</small>
          </div>
        </div>

        {error && <p className="alert alert-red">{error}</p>}

        {d.status === 'awaiting_parent' && (
          <>
            <h2 className="parent-ask">{t('क्या बच्चे को भेजना है?')}</h2>
            {!confirmNo ? (
              <div className="parent-actions">
                <button className="btn btn-green btn-xl" onClick={() => decide('yes')} disabled={busy}>{t('✓ हाँ, भेज दो')}</button>
                <button className="btn btn-red btn-xl" onClick={() => setConfirmNo(true)} disabled={busy}>{t('✕ नहीं, मत भेजो')}</button>
              </div>
            ) : (
              <div className="banner banner-red">
                <b>{t('पक्का मना करना है?')}</b>
                <span>{t('गार्ड बच्चे को नहीं सौंपेगा।')}</span>
                <div className="row gap mt">
                  <button className="btn btn-red grow" onClick={() => decide('no')} disabled={busy}>{t('हाँ, मना करें')}</button>
                  <button className="btn btn-outline grow" onClick={() => setConfirmNo(false)}>{t('वापस')}</button>
                </div>
              </div>
            )}
            <p className="tiny muted center">⏱ {t('{time} में यह लिंक बंद हो जाएगा', { time: mmss(left) })}</p>
          </>
        )}

        {d.status === 'approved' && (
          <div className="banner banner-green">
            <b>{t('✓ आपने हाँ कहा')}</b>
            <span>{t('अब यह OTP सिर्फ {name} को बताएँ। गार्ड OTP मिलाकर ही बच्चा सौंपेगा।', { name: d.pickerName })}</span>
          </div>
        )}
        {live && d.otp && (
          <div className="otp-show">
            <small>OTP</small>
            <b data-testid="parent-otp">{d.otp}</b>
            <small>{d.status === 'approved' ? t('{time} तक मान्य · एक ही बार चलेगा', { time: mmss(left) }) : t('भेजना हो तभी लेने वाले को बताएँ')}</small>
          </div>
        )}
        {d.status === 'denied' && (
          <div className="banner banner-red"><b>{t('आपने मना किया')}</b><span>{t('बच्चा नहीं सौंपा जाएगा। गार्ड और स्कूल को सूचना चली गई है।')}</span></div>
        )}
        {d.status === 'completed' && (
          <div className="banner banner-green"><b>{t('✓ बच्चा सौंप दिया गया')}</b><span>{t('{name} ने सही OTP बताया।', { name: d.pickerName })}</span></div>
        )}
        {['expired', 'cancelled', 'locked'].includes(d.status) && (
          <div className="banner banner-amber">
            <b>{d.status === 'expired' ? t('समय खत्म हो गया') : d.status === 'locked' ? t('गलत OTP की वजह से पिकअप बंद') : t('पिकअप रद्द हुआ')}</b>
            <span>{t('यह लिंक अब काम नहीं करेगा।')}{d.officePhone ? ' ' + t('स्कूल ऑफिस से बात करें।') : ''}</span>
          </div>
        )}
        {d.officePhone && <a className="btn btn-outline btn-block mt" href={`tel:${d.officePhone}`}>📞 {t('स्कूल ऑफिस')}: {d.officePhone}</a>}
      </div>
    </div>
  );
}
