import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { Spinner } from '../../ui/bits.jsx';
import { time, mmss } from '../../lib/format.js';

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

  if (!d && !error) return <Spinner label="खुल रहा है…" />;
  if (!d) {
    return (
      <div className="parent">
        <div className="parent-card center">
          <div className="big-icon">🔒</div>
          <h1>लिंक नहीं खुला</h1>
          <p>{error}</p>
          <p className="muted">हर पिकअप का लिंक अलग होता है और कुछ मिनट में खत्म हो जाता है।</p>
        </div>
      </div>
    );
  }

  const live = ['awaiting_parent', 'approved'].includes(d.status);
  return (
    <div className="parent">
      <header className="parent-head">
        <img src="/icon.svg" alt="" width="32" height="32" />
        <div><b>{d.school}</b><small>सुरक्षित पिकअप</small></div>
      </header>

      <div className="parent-card">
        <div className="parent-child">
          {d.studentPhotoUrl && <img src={d.studentPhotoUrl} alt={d.studentName} />}
          <div>
            <small className="muted">आपका बच्चा</small>
            <b>{d.studentName}</b>
            <span className="muted">क्लास {d.className}</span>
          </div>
        </div>

        <h1 className="parent-q">{d.status === 'awaiting_parent' ? 'कोई आपके बच्चे को लेने आया है' : 'लेने आए व्यक्ति'}</h1>
        <div className="picker-big">
          {d.pickerPhotoUrl ? <img src={d.pickerPhotoUrl} alt="लेने आए व्यक्ति की फोटो" /> : <div className="ph">फोटो उपलब्ध नहीं</div>}
          <div className="picker-meta">
            <b>{d.pickerName}</b>
            {d.relation && <span>रिश्ता: {d.relation}</span>}
            <small className="muted">गेट पर {time(d.requestedAt)}</small>
          </div>
        </div>

        {error && <p className="alert alert-red">{error}</p>}

        {d.status === 'awaiting_parent' && (
          <>
            <h2 className="parent-ask">क्या बच्चे को भेजना है?</h2>
            {!confirmNo ? (
              <div className="parent-actions">
                <button className="btn btn-green btn-xl" onClick={() => decide('yes')} disabled={busy}>✓ हाँ, भेज दो</button>
                <button className="btn btn-red btn-xl" onClick={() => setConfirmNo(true)} disabled={busy}>✕ नहीं, मत भेजो</button>
              </div>
            ) : (
              <div className="banner banner-red">
                <b>पक्का मना करना है?</b>
                <span>गार्ड बच्चे को नहीं सौंपेगा।</span>
                <div className="row gap mt">
                  <button className="btn btn-red grow" onClick={() => decide('no')} disabled={busy}>हाँ, मना करें</button>
                  <button className="btn btn-outline grow" onClick={() => setConfirmNo(false)}>वापस</button>
                </div>
              </div>
            )}
            <p className="tiny muted center">⏱ {mmss(left)} में यह लिंक बंद हो जाएगा</p>
          </>
        )}

        {d.status === 'approved' && (
          <div className="banner banner-green">
            <b>✓ आपने हाँ कहा</b>
            <span>अब यह OTP सिर्फ <b>{d.pickerName}</b> को बताएँ। गार्ड OTP मिलाकर ही बच्चा सौंपेगा।</span>
          </div>
        )}
        {live && d.otp && (
          <div className="otp-show">
            <small>OTP</small>
            <b data-testid="parent-otp">{d.otp}</b>
            <small>{d.status === 'approved' ? `${mmss(left)} तक मान्य · एक ही बार चलेगा` : 'भेजना हो तभी लेने वाले को बताएँ'}</small>
          </div>
        )}
        {d.status === 'denied' && (
          <div className="banner banner-red"><b>आपने मना किया</b><span>बच्चा नहीं सौंपा जाएगा। गार्ड और स्कूल को सूचना चली गई है।</span></div>
        )}
        {d.status === 'completed' && (
          <div className="banner banner-green"><b>✓ बच्चा सौंप दिया गया</b><span>{d.pickerName} ने सही OTP बताया।</span></div>
        )}
        {['expired', 'cancelled', 'locked'].includes(d.status) && (
          <div className="banner banner-amber">
            <b>{d.status === 'expired' ? 'समय खत्म हो गया' : d.status === 'locked' ? 'गलत OTP की वजह से पिकअप बंद' : 'पिकअप रद्द हुआ'}</b>
            <span>यह लिंक अब काम नहीं करेगा।{d.officePhone ? ' स्कूल ऑफिस से बात करें।' : ''}</span>
          </div>
        )}
        {d.officePhone && <a className="btn btn-outline btn-block mt" href={`tel:${d.officePhone}`}>📞 स्कूल ऑफिस: {d.officePhone}</a>}
      </div>
    </div>
  );
}
