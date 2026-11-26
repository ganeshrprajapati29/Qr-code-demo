import { useCallback, useEffect, useState } from 'react';
import { get, post } from '../../api.js';
import { Spinner, Empty } from '../../ui/bits.jsx';
import { dateTime } from '../../lib/format.js';
import { t, getLang } from '../../i18n.jsx';

export default function Alerts() {
  const [all, setAll] = useState(false);
  const [list, setList] = useState(null);
  const load = useCallback(() => get(`/alerts${all ? '?all=1' : ''}`).then((r) => setList(r.alerts)), [all]);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="page">
      <div className="row between center-v">
        <h1 className="page-title">{t('अलर्ट')}</h1>
        <label className="tiny row gap center-v"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> {t('पुराने भी')}</label>
      </div>
      {!list ? <Spinner /> : list.length === 0 ? <Empty title={t('कोई नया अलर्ट नहीं ✓')} /> : (
        <>
          {!all && <button className="btn btn-outline btn-sm mb" onClick={() => post('/alerts/resolve-all').then(load)}>{t('सब ठीक है मार्क करें')}</button>}
          {list.map((a) => (
            <div key={a.id} className={`alert ${a.resolvedAt ? 'alert-grey' : 'alert-red'}`}>
              <div>{getLang() === 'en' ? a.textEn || a.text : a.text}</div>
              <small className="muted">{dateTime(a.createdAt)}{a.resolvedAt && ` · ${t('देखा')}: ${a.resolvedBy}`}</small>
              {!a.resolvedAt && <button className="link" onClick={() => post(`/alerts/${a.id}/resolve`).then(load)}>{t('ठीक है')}</button>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
