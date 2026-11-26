import { useCallback, useEffect, useMemo, useState } from 'react';
import { get, post } from '../../api.js';
import { Spinner, Ticks, Empty } from '../../ui/bits.jsx';
import { dateTime, time } from '../../lib/format.js';
import { t } from '../../i18n.jsx';

const KIND = { arrival: 'आया', exit: 'निकला', pickup_request: 'पिकअप', pickup_done: 'सौंपा', alert: 'अलर्ट' };

export default function Messages() {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [phone, setPhone] = useState(''); // demo phone view
  const load = useCallback(() => get(`/admin/messages?limit=200${failed ? '&failed=1' : ''}`).then(setData), [failed]);
  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);
  const phones = useMemo(() => {
    const m = new Map();
    (data?.messages || []).forEach((x) => { if (!m.has(x.to)) m.set(x.to, x.student); });
    return [...m.entries()];
  }, [data]);
  if (!data) return <Spinner />;
  const demo = data.provider === 'demo';
  return (
    <div className="page">
      <h1 className="page-title">{t('मैसेज')}</h1>
      <p className="tiny muted">{t('तरीका:')} <b>{demo ? t('डेमो — असली SMS/WhatsApp नहीं जाते, नीचे “माँ-बाप का फोन” में दिखते हैं') : 'WhatsApp Cloud API'}</b></p>
      {demo && (
        <div className="card demo-phone-pick">
          <b>{t('📱 डेमो: माँ-बाप का फोन')}</b>
          <select value={phone} onChange={(e) => setPhone(e.target.value)} aria-label={t('किस माँ-बाप का फोन')}>
            <option value="">{t('— बच्चा चुनें —')}</option>
            {phones.map(([p, s]) => <option key={p} value={p}>{s ? `${s.name} (${s.className})` : p} · {p}</option>)}
          </select>
        </div>
      )}
      {phone ? <DemoPhone phone={phone} messages={data.messages.filter((m) => m.to === phone)} onBack={() => setPhone('')} /> : (
        <>
          <div className="chips mb">
            <button className={!failed ? 'chip-btn on' : 'chip-btn'} onClick={() => setFailed(false)}>{t('सभी')}</button>
            <button className={failed ? 'chip-btn on' : 'chip-btn'} onClick={() => setFailed(true)}>{t('नहीं पहुँचे')}</button>
          </div>
          {data.messages.length === 0 ? <Empty title={t('अभी कोई मैसेज नहीं')} /> : (
            <ul className="list">
              {data.messages.map((m) => (
                <li key={m.id} className="list-row col">
                  <div className="row between"><span><span className="chip chip-grey">{t(KIND[m.kind])}</span> <b>{m.student?.name}</b> <small className="muted">{m.to}</small></span><Ticks status={m.status} /></div>
                  <div className="tiny">{m.text}</div>
                  <small className="muted">{dateTime(m.createdAt)}{m.error && <span className="c-red"> · {t(m.error)}</span>}</small>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

// a phone-like inbox to test the parent's side without real SMS/WhatsApp
function DemoPhone({ phone, messages, onBack }) {
  const list = [...messages].reverse();
  useEffect(() => {
    list.filter((m) => m.status === 'delivered' || m.status === 'sent').forEach((m) => post(`/admin/messages/${m.id}/demo-read`).catch(() => {}));
  }, [list.map((m) => m.id + m.status).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const linkify = (text) => text.split(/(https?:\/\/\S+)/g).map((part, i) => (/^https?:\/\//.test(part) ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" data-testid="parent-link">{part}</a> : part));
  return (
    <div className="phone">
      <div className="phone-bar"><button className="link light" onClick={onBack}>←</button><b>{t('स्कूल')} · {phone}</b></div>
      <div className="phone-body">
        {list.length === 0 && <p className="muted center">{t('कोई मैसेज नहीं')}</p>}
        {list.map((m) => (
          <div key={m.id} className={`bubble ${m.kind === 'pickup_request' || m.kind === 'alert' ? 'warn' : ''}`}>
            <div>{linkify(m.text)}</div>
            <small>{time(m.createdAt)} {m.status === 'failed' ? t('✕ नहीं पहुँचा') : ''}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
