import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { rupees, balanceInfo, shortDate, relativeDay } from '../format.js';
import TxnForm from '../components/TxnForm.jsx';
import CustomerForm from '../components/CustomerForm.jsx';
import ReminderSheet from '../components/ReminderSheet.jsx';
import { useToast } from '../components/Toast.jsx';

const QrCardModal = lazy(() => import('../components/QrCardModal.jsx'));

export default function CustomerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [showQr, setShowQr] = useState(false);
  const [shopName, setShopName] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [txnType, setTxnType] = useState(null);
  const [editing, setEditing] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [apiEnabled, setApiEnabled] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.getCustomer(id));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => {
    load();
    api.config().then((c) => { setApiEnabled(c.whatsappApiEnabled); setShopName(c.shopName); }).catch(() => {});
  }, [load]);

  useEffect(() => {
    if (location.state?.fromScan) toast('QR कार्ड से खाता खुला');
  }, [location.state, toast]);

  // running balance after each entry (oldest -> newest)
  const rows = useMemo(() => {
    if (!data) return [];
    const chron = [...data.transactions].reverse();
    let run = 0;
    const withRun = chron.map((t) => {
      run = Math.round((run + (t.type === 'udhar' ? t.amount : -t.amount)) * 100) / 100;
      return { ...t, running: run };
    });
    return withRun.reverse();
  }, [data]);

  if (error) {
    return (
      <div className="page">
        <Link to="/" className="back">← सभी ग्राहक</Link>
        <div className="notice notice-warn">{error}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="page">
        <Link to="/" className="back">← सभी ग्राहक</Link>
        <div className="skeleton" style={{ height: 180, marginTop: 16 }} />
      </div>
    );
  }

  const c = data.customer;
  const info = balanceInfo(c.balance);

  async function addTxn(payload) {
    await api.addTxn(c.id, payload);
    setTxnType(null);
    toast(payload.type === 'udhar' ? `₹${payload.amount} उधार लिखा गया` : `₹${payload.amount} जमा लिखा गया`);
    load();
  }

  async function removeTxn(t) {
    if (!confirm(`${shortDate(t.date)} की ${rupees(t.amount)} की ${t.type === 'udhar' ? 'उधार' : 'जमा'} एंट्री हटाएँ?`)) return;
    try {
      await api.deleteTxn(t.id);
      toast('एंट्री हटा दी गई');
      load();
    } catch (e) {
      toast(e.message, 'err');
    }
  }

  async function saveEdit(payload) {
    await api.updateCustomer(c.id, payload);
    setEditing(false);
    toast('जानकारी अपडेट हो गई');
    load();
  }

  async function removeCustomer() {
    if (!confirm(`${c.name} और उनका पूरा हिसाब हमेशा के लिए हटाएँ?`)) return;
    try {
      await api.deleteCustomer(c.id);
      toast('ग्राहक हटा दिया गया');
      navigate('/');
    } catch (e) {
      toast(e.message, 'err');
    }
  }

  return (
    <div className="page page-customer">
      <div className="detail-top">
        <Link to="/" className="back">← सभी ग्राहक</Link>
        <div className="detail-tools">
          <button className="link-btn" onClick={() => setShowQr(true)}>QR कार्ड</button>
          <button className="link-btn" onClick={() => setEditing(true)}>बदलें</button>
          <button className="link-btn c-due" onClick={removeCustomer}>हटाएँ</button>
        </div>
      </div>

      <section className={`balance-card tone-${info.tone}`}>
        <h1>{c.name}</h1>
        <a href={`tel:+91${c.phone}`} className="phone-link">📞 +91 {c.phone.replace(/(\d{5})(\d{5})/, '$1 $2')}</a>
        <div className="balance-amount">
          <strong>{rupees(c.balance)}</strong>
          <span>{info.label}</span>
        </div>
        <div className="balance-split">
          <div><span>कुल उधार</span><b>{rupees(c.totalUdhar)}</b></div>
          <div><span>कुल जमा</span><b>{rupees(c.totalJama)}</b></div>
        </div>
      </section>

      <div className="action-row">
        <button className="btn btn-due" onClick={() => setTxnType('udhar')}>− उधार दिया</button>
        <button className="btn btn-adv" onClick={() => setTxnType('jama')}>+ जमा मिला</button>
      </div>

      {c.balance > 0 && (
        <button className="reminder-cta" onClick={() => setReminding(true)}>
          <span>🔔</span>
          <span>
            <b>{rupees(c.balance)} याद दिलाएँ</b>
            <small>{c.lastReminderAt ? `पिछली बार ${relativeDay(c.lastReminderAt)} याद दिलाया` : 'WhatsApp या SMS से मैसेज भेजें'}</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
      )}

      <h2 className="section-title">हिसाब ({rows.length} एंट्री)</h2>
      {rows.length === 0 ? (
        <div className="empty small">
          <p>अभी कोई एंट्री नहीं है। ऊपर “उधार दिया” या “जमा मिला” दबाएँ।</p>
        </div>
      ) : (
        <ul className="txn-list">
          {rows.map((t) => (
            <li key={t.id} className="txn">
              <div className="txn-left">
                <span className={`txn-badge ${t.type === 'udhar' ? 'b-due' : 'b-adv'}`}>{t.type === 'udhar' ? 'उधार' : 'जमा'}</span>
                <div>
                  <div className="txn-date">{shortDate(t.date)}</div>
                  {t.note && <div className="txn-note">{t.note}</div>}
                </div>
              </div>
              <div className="txn-right">
                <strong className={t.type === 'udhar' ? 'c-due' : 'c-adv'}>{t.type === 'udhar' ? '−' : '+'} {rupees(t.amount)}</strong>
                <small>बाक़ी {rupees(t.running)}{t.running < 0 ? ' एडवांस' : ''}</small>
              </div>
              <button className="icon-btn del" onClick={() => removeTxn(t)} aria-label="एंट्री हटाएँ">🗑</button>
            </li>
          ))}
        </ul>
      )}

      {txnType && <TxnForm customer={c} defaultType={txnType} onSubmit={addTxn} onClose={() => setTxnType(null)} />}
      {editing && <CustomerForm title="ग्राहक की जानकारी बदलें" submitLabel="सेव करें" initial={c} onSubmit={saveEdit} onClose={() => setEditing(false)} />}
      {showQr && (
        <Suspense fallback={null}>
          <QrCardModal customer={c} shopName={shopName} onClose={() => setShowQr(false)} onChanged={load} />
        </Suspense>
      )}
      {reminding && <ReminderSheet customer={c} apiEnabled={apiEnabled} onClose={() => setReminding(false)} onSent={load} />}
    </div>
  );
}
