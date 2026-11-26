import { useEffect, useMemo, useState } from 'react';
import { get } from '../../api.js';
import { Spinner, ErrorBox } from '../../ui/bits.jsx';
import { monthKey } from '../../lib/format.js';
import { t } from '../../i18n.jsx';

export default function Monthly() {
  const [month, setMonth] = useState(monthKey());
  const [cls, setCls] = useState('');
  const [r, setR] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setR(null);
    get(`/reports/monthly?month=${month}`).then(setR).catch((e) => setError(e.message));
  }, [month]);
  const classes = useMemo(() => (r ? [...new Set(r.students.map((s) => s.className))] : []), [r]);
  const rows = r ? r.students.filter((s) => !cls || s.className === cls) : [];

  function csv() {
    const lines = [[t('नाम'), t('क्लास'), t('रोल'), t('आए'), t('नहीं आए'), t('कुल दिन')], ...rows.map((s) => [s.name, s.className, s.rollNo, s.present, s.absent, r.schoolDays])];
    const blob = new Blob(['﻿' + lines.map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hazri-${month}${cls ? '-' + cls : ''}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <div className="page">
      <div className="row between center-v">
        <h1 className="page-title">{t('महीने की हाज़िरी')}</h1>
        <input type="month" className="date-input" value={month} max={monthKey()} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label={t('महीना')} />
      </div>
      <ErrorBox error={error} />
      {!r ? <Spinner /> : (
        <>
          <p className="muted">{t('इस महीने स्कूल के दिन:')} <b>{r.schoolDays}</b> {t('(जिन दिनों गेट पर स्कैन हुआ)')}</p>
          <div className="chips mb">
            <button className={!cls ? 'chip-btn on' : 'chip-btn'} onClick={() => setCls('')}>{t('सभी')}</button>
            {classes.map((c) => <button key={c} className={cls === c ? 'chip-btn on' : 'chip-btn'} onClick={() => setCls(c)}>{c}</button>)}
            <button className="chip-btn" onClick={csv} disabled={!rows.length}>⬇ Excel/CSV</button>
          </div>
          <ul className="list">
            {rows.map((s) => (
              <li key={s.id} className="list-row col">
                <div className="row between"><span><b>{s.name}</b> <span className="muted">({s.className})</span></span><span className="tiny"><span className="c-green">{t('{n} दिन आया', { n: s.present })}</span> · <span className="c-red">{t('{n} दिन नहीं', { n: s.absent })}</span></span></div>
                <div className="bar"><i style={{ width: `${r.schoolDays ? (s.present / r.schoolDays) * 100 : 0}%` }} /></div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
