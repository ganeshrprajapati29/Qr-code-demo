import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post, patch, del } from '../../api.js';
import Modal from '../../ui/Modal.jsx';
import Camera from '../../ui/Camera.jsx';
import { Photo, Spinner, Empty, ErrorBox } from '../../ui/bits.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { fileToDataUrl } from '../../lib/image.js';
import { downloadCardsPdf } from '../../lib/cards.js';
import { t } from '../../i18n.jsx';

export default function Students() {
  const [classes, setClasses] = useState([]);
  const [cls, setCls] = useState('');
  const [search, setSearch] = useState('');
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null); // student | {} for new
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams({ ...(cls && { class: cls }), ...(search && { search }) });
      const [l, c] = await Promise.all([get(`/students?${q}`), get('/students/classes')]);
      setList(l.students);
      setClasses(c.classes);
    } catch (e) {
      setError(e.message);
    }
  }, [cls, search]);
  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  return (
    <div className="page">
      <div className="row between center-v">
        <h1 className="page-title">{t('बच्चे')}</h1>
        <div className="row gap">
          <button className="btn btn-outline btn-sm" onClick={() => setImporting(true)}>⬆ Excel/CSV</button>
          <button className="btn btn-primary btn-sm" onClick={() => setEdit({})}>{t('+ जोड़ें')}</button>
        </div>
      </div>
      <input type="search" className="search" placeholder={t('नाम, रोल या मोबाइल से खोजें')} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t('खोजें')} />
      <div className="chips mb">
        <button className={!cls ? 'chip-btn on' : 'chip-btn'} onClick={() => setCls('')}>{t('सभी')}</button>
        {classes.map((c) => <button key={c.className} className={cls === c.className ? 'chip-btn on' : 'chip-btn'} onClick={() => setCls(c.className)}>{c.className} <small>({c.count})</small></button>)}
      </div>
      <ErrorBox error={error} />
      {!list ? <Spinner /> : list.length === 0 ? (
        <Empty title={search ? t('कोई बच्चा नहीं मिला') : t('अभी कोई बच्चा नहीं')}><button className="btn btn-primary" onClick={() => setEdit({})}>{t('+ पहला बच्चा जोड़ें')}</button></Empty>
      ) : (
        <ul className="list">
          {list.map((s) => (
            <li key={s.id}>
              <button className="list-row btn-row" onClick={() => setEdit(s)}>
                <Photo src={s.photoUrl} name={s.name} size={44} />
                <div className="grow">
                  <b>{s.name}</b>
                  <div className="tiny muted">{t('क्लास')} {s.className}{s.rollNo && ` · ${t('रोल')} ${s.rollNo}`} · {s.guardianPhone}{s.guardianLang === 'en' && ' · EN'}</div>
                </div>
                {s.phoneStatus === 'failed' && <span className="chip chip-red" title={s.phoneStatusNote}>{t('नंबर ⚠')}</span>}
                {!s.photoUrl && <span className="chip chip-amber">{t('फोटो नहीं')}</span>}
                <i className="muted" aria-hidden="true">›</i>
              </button>
            </li>
          ))}
        </ul>
      )}
      {list && list.length > 0 && <Link className="btn btn-outline btn-block mt" to={`/cards${cls ? `?class=${cls}` : ''}`}>{t('🪪 इनके QR कार्ड की PDF बनाएँ')}</Link>}
      {edit && <StudentForm student={edit.id ? edit : null} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
      {importing && <ImportModal onClose={() => setImporting(false)} onDone={() => { setImporting(false); load(); }} />}
    </div>
  );
}

function StudentForm({ student, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({ name: student?.name || '', className: student?.className || '', rollNo: student?.rollNo || '', guardianName: student?.guardianName || '', guardianPhone: student?.guardianPhone || '', guardianLang: student?.guardianLang || 'hi' });
  const [photo, setPhoto] = useState('');
  const [camera, setCamera] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(null);
  const fileRef = useRef(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (student) get(`/students/${student.id}`).then((r) => setFull(r.student)).catch(() => {});
  }, [student]);

  async function save(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body = { ...f, ...(photo && { photo }) };
      if (student) await patch(`/students/${student.id}`, body);
      else await post('/students', body);
      toast(student ? t('जानकारी अपडेट हुई') : t('बच्चा जुड़ गया — अब कार्ड बना सकते हैं'));
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  async function newCard() {
    if (!confirm(t('पुराना कार्ड हमेशा के लिए बंद हो जाएगा और नया QR बनेगा। आगे बढ़ें?'))) return;
    try {
      const r = await post(`/students/${student.id}/new-card`);
      setFull(r.student);
      toast(t('नया कार्ड बना — पुराना कार्ड बंद'));
      await downloadCardsPdf([r.student], `card-${r.student.name}.pdf`);
    } catch (e) {
      toast(e.message, 'err');
    }
  }
  async function remove() {
    if (!confirm(t('{name} को सूची से हटाएँ? उनका कार्ड बंद हो जाएगा (पुराना रिकॉर्ड रहेगा)।', { name: student.name }))) return;
    await del(`/students/${student.id}`);
    toast(t('बच्चा हटाया गया, कार्ड बंद'));
    onSaved();
  }

  return (
    <Modal title={student ? t('बच्चे की जानकारी') : t('नया बच्चा जोड़ें')} onClose={onClose}>
      {camera ? (
        <>
          <Camera facing="environment" onPhoto={(p) => { setPhoto(p); setCamera(false); }} />
          <button className="btn btn-outline btn-block mt" onClick={() => setCamera(false)}>{t('वापस')}</button>
        </>
      ) : (
        <form className="form" onSubmit={save} noValidate>
          <div className="photo-edit">
            {photo ? <img src={photo} alt={t('नई फोटो')} /> : <Photo src={student?.photoUrl} name={f.name} size={96} />}
            <div className="col gap-s">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setCamera(true)}>{t('📷 फोटो खींचें')}</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>{t('🖼 फोटो चुनें')}</button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (file) setPhoto(await fileToDataUrl(file, 600)); e.target.value = ''; }} />
            </div>
          </div>
          <label className="field"><span>{t('बच्चे का नाम *')}</span><input value={f.name} onChange={set('name')} maxLength={80} /></label>
          <div className="row-2">
            <label className="field"><span>{t('क्लास *')}</span><input value={f.className} onChange={set('className')} placeholder={t('जैसे 5A')} maxLength={12} /></label>
            <label className="field"><span>{t('रोल नंबर')}</span><input value={f.rollNo} onChange={set('rollNo')} maxLength={12} /></label>
          </div>
          <label className="field"><span>{t('माँ-बाप का मोबाइल *')}</span><input value={f.guardianPhone} onChange={set('guardianPhone')} inputMode="tel" maxLength={16} placeholder={t('10 अंक')} /></label>
          <label className="field"><span>{t('अभिभावक का नाम')}</span><input value={f.guardianName} onChange={set('guardianName')} maxLength={60} /></label>
          <label className="field"><span>{t('माँ-बाप की भाषा (मैसेज और लिंक)')}</span>
            <select value={f.guardianLang} onChange={set('guardianLang')}>
              <option value="hi">हिंदी</option>
              <option value="en">English</option>
            </select>
          </label>
          {student?.phoneStatus === 'failed' && <p className="alert alert-red">⚠ {t('इस नंबर पर मैसेज नहीं पहुँच रहा:')} {t(student.phoneStatusNote)}</p>}
          <ErrorBox error={error} />
          <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? t('सेव हो रहा है…') : t('सेव करें')}</button>
          {student && full && (
            <div className="card subtle">
              <b>{t('QR कार्ड')}</b> <span className="muted tiny">({t('वर्ज़न {n}', { n: full.cardVersion })})</span>
              <div className="row gap wrap mt-s">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => downloadCardsPdf([full], `card-${full.name}.pdf`)}>{t('⬇ कार्ड PDF')}</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={newCard}>{t('कार्ड खो गया — नया बनाएँ')}</button>
                <button type="button" className="btn btn-ghost-red btn-sm" onClick={remove}>{t('सूची से हटाएँ')}</button>
              </div>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}

const TEMPLATE = '﻿name,class,mobile,roll,parent,language\nआरव शर्मा,5A,9876543210,1,सुनील शर्मा,hindi\nSiya Verma,5A,9876543211,2,,english\n';

function ImportModal({ onClose, onDone }) {
  const toast = useToast();
  const [csv, setCsv] = useState('');
  const [check, setCheck] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  async function pick(file) {
    if (!file) return;
    setError('');
    setCheck(null);
    if (/\.xlsx?$/i.test(file.name)) return setError(t('Excel फ़ाइल को “Save As → CSV UTF-8” से सेव करके चुनें।'));
    const text = await file.text();
    setCsv(text);
    setBusy(true);
    try {
      setCheck(await post('/students/import', { csv: text, dryRun: true }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function run() {
    setBusy(true);
    try {
      const r = await post('/students/import', { csv });
      toast(t('{n} बच्चे जुड़ गए', { n: r.imported }));
      onDone();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  function template() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }));
    a.download = 'bachche-template.csv';
    a.click();
  }
  return (
    <Modal title={t('Excel / CSV से बच्चे जोड़ें')} onClose={onClose}>
      <ol className="steps-text">
        <li>{t('टेम्पलेट डाउनलोड करें, Excel में भरें (name, class, mobile ज़रूरी)।')}</li>
        <li>{t('“Save As → CSV UTF-8” से सेव करें और यहाँ चुनें।')}</li>
        <li>{t('जाँच के बाद “जोड़ें” दबाएँ। फोटो बाद में हर बच्चे में जोड़ें।')}</li>
      </ol>
      <div className="row gap">
        <button className="btn btn-outline grow" onClick={template}>{t('⬇ टेम्पलेट')}</button>
        <button className="btn btn-primary grow" onClick={() => fileRef.current?.click()}>{t('फ़ाइल चुनें')}</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv,.xlsx,.xls" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      <ErrorBox error={error} />
      {busy && <Spinner />}
      {check && (
        <div className="mt">
          <p><b className="c-green">{t('{n} बच्चे सही', { n: check.valid })}</b>{check.errors.length > 0 && <b className="c-red"> · {t('{n} लाइन में गलती', { n: check.errors.length })}</b>}</p>
          {check.errors.length > 0 && <ul className="mini-list c-red">{check.errors.slice(0, 20).map((e) => <li key={e.line}>{t('लाइन {n}', { n: e.line })}: {e.error}</li>)}</ul>}
          {check.errors.length > 0 ? <p className="tiny muted">{t('गलतियाँ ठीक करके फ़ाइल दोबारा चुनें।')}</p> : (
            <button className="btn btn-green btn-lg btn-block" onClick={run} disabled={busy || !check.valid}>{t('{n} बच्चे जोड़ें', { n: check.valid })}</button>
          )}
        </div>
      )}
    </Modal>
  );
}
