import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { get } from '../../api.js';
import { Spinner, ErrorBox } from '../../ui/bits.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { downloadCardsPdf, drawCard } from '../../lib/cards.js';
import { t } from '../../i18n.jsx';

export default function Cards() {
  const toast = useToast();
  const [params] = useSearchParams();
  const [classes, setClasses] = useState(null);
  const [cls, setCls] = useState(params.get('class') || '');
  const [progress, setProgress] = useState(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { get('/students/classes').then((r) => setClasses(r.classes)).catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    let alive = true;
    setPreview('');
    (async () => {
      const r = await get(`/students/cards${cls ? `?class=${cls}` : ''}`);
      if (!r.students[0]) return;
      const me = await get('/auth/me');
      await document.fonts.load('800 40px Mukta');
      const c = await drawCard(r.students[0], me.school);
      if (alive) setPreview(c.toDataURL('image/jpeg', 0.85));
    })().catch(() => {});
    return () => { alive = false; };
  }, [cls]);

  async function make() {
    setError('');
    try {
      const r = await get(`/students/cards${cls ? `?class=${cls}` : ''}`);
      if (!r.students.length) return setError(t('इस क्लास में कोई बच्चा नहीं'));
      setProgress([0, r.students.length]);
      await downloadCardsPdf(r.students, `qr-cards-${cls || 'sabhi'}.pdf`, (a, b) => setProgress([a, b]));
      toast(t('{n} कार्ड की PDF डाउनलोड हुई', { n: r.students.length }));
    } catch (e) {
      setError(e.message);
    } finally {
      setProgress(null);
    }
  }

  if (!classes) return error ? <div className="page"><ErrorBox error={error} /></div> : <Spinner />;
  return (
    <div className="page">
      <h1 className="page-title">{t('QR कार्ड प्रिंट')}</h1>
      <p className="muted">{t('A4 पेज पर 10 कार्ड (क्रेडिट-कार्ड साइज़)। हर QR अलग और रैंडम है — उसमें बच्चे का नाम या नंबर नहीं है।')}</p>
      <div className="chips mb">
        <button className={!cls ? 'chip-btn on' : 'chip-btn'} onClick={() => setCls('')}>{t('सभी')}</button>
        {classes.map((c) => <button key={c.className} className={cls === c.className ? 'chip-btn on' : 'chip-btn'} onClick={() => setCls(c.className)}>{c.className} ({c.count})</button>)}
      </div>
      {preview ? <img className="card-preview" src={preview} alt={t('कार्ड का नमूना')} /> : <div className="skeleton card-preview" />}
      <ErrorBox error={error} />
      <button className="btn btn-primary btn-lg btn-block mt" onClick={make} disabled={Boolean(progress)}>
        {progress ? t('बन रहा है… {a}/{b}', { a: progress[0], b: progress[1] }) : '⬇ ' + (cls ? t('क्लास {c} के कार्ड की PDF', { c: cls }) : t('सभी कार्ड की PDF'))}
      </button>
      <p className="tiny muted mt">{t('खोया हुआ कार्ड: “बच्चे” में बच्चे को खोलें → “कार्ड खो गया — नया बनाएँ”। पुराना QR उसी समय बंद हो जाता है।')}</p>
    </div>
  );
}
