import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { rupees, balanceInfo, initials, relativeDay } from '../format.js';
import CustomerForm from '../components/CustomerForm.jsx';
import { useToast } from '../components/Toast.jsx';

const SORTS = [
  { key: 'balance', label: 'ज़्यादा बाक़ी' },
  { key: 'recent', label: 'हाल के' },
  { key: 'name', label: 'नाम से' },
];

export default function Home() {
  const toast = useToast();
  const navigate = useNavigate();
  const [shopName, setShopName] = useState('');
  const [summary, setSummary] = useState(null);
  const [customers, setCustomers] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('balance');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(
    async (q = search, s = sort) => {
      try {
        const [list, sum] = await Promise.all([api.listCustomers(q, s), api.summary()]);
        setCustomers(list.customers);
        setSummary(sum);
        setError('');
      } catch (e) {
        setError(e.message);
      }
    },
    [search, sort]
  );

  useEffect(() => {
    api.config().then((c) => setShopName(c.shopName)).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search, sort), search ? 250 : 0);
    return () => clearTimeout(t);
  }, [search, sort, load]);

  async function addCustomer(data) {
    const { customer } = await api.addCustomer(data);
    setAdding(false);
    toast(`${customer.name} जुड़ गए`);
    navigate(`/customer/${customer.id}`);
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">दुकान का उधार खाता</p>
          <h1>{shopName || 'उधार खाता'}</h1>
        </div>
      </header>

      <section className="summary">
        <div className="summary-main">
          <span>कुल लेना है</span>
          <strong>{summary ? rupees(summary.toCollect) : '—'}</strong>
          <small>{summary ? `${summary.dueCustomers} ग्राहकों से` : ' '}</small>
        </div>
        <div className="summary-side">
          <div>
            <span>ग्राहक</span>
            <strong>{summary ? summary.customers : '—'}</strong>
          </div>
          <div>
            <span>एडवांस जमा</span>
            <strong>{summary ? rupees(summary.advance) : '—'}</strong>
          </div>
        </div>
      </section>

      <div className="search">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M10 2a8 8 0 0 1 6.3 12.9l5.4 5.4-1.4 1.4-5.4-5.4A8 8 0 1 1 10 2Zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z" /></svg>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="नाम या नंबर से खोजें" aria-label="ग्राहक खोजें" />
        {search && <button className="icon-btn" onClick={() => setSearch('')} aria-label="खोज साफ़ करें">✕</button>}
      </div>

      <div className="chips" role="tablist" aria-label="क्रम">
        {SORTS.map((s) => (
          <button key={s.key} role="tab" aria-selected={sort === s.key} className={sort === s.key ? 'chip active' : 'chip'} onClick={() => setSort(s.key)}>
            {s.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="notice notice-warn">
          {error} <button className="link-btn" onClick={() => load()}>दोबारा कोशिश करें</button>
        </div>
      )}

      {customers === null && !error && (
        <div className="list">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton row-skel" />)}</div>
      )}

      {customers && customers.length === 0 && (
        <div className="empty">
          {search ? (
            <>
              <p>“{search}” नाम का कोई ग्राहक नहीं मिला।</p>
              <button className="btn btn-outline" onClick={() => setAdding(true)}>नया ग्राहक जोड़ें</button>
            </>
          ) : (
            <>
              <p className="empty-title">अभी कोई ग्राहक नहीं है</p>
              <p>पहला ग्राहक जोड़ें और उधार लिखना शुरू करें।</p>
              <button className="btn btn-primary" onClick={() => setAdding(true)}>+ पहला ग्राहक जोड़ें</button>
            </>
          )}
        </div>
      )}

      {customers && customers.length > 0 && (
        <ul className="list">
          {customers.map((c) => {
            const info = balanceInfo(c.balance);
            return (
              <li key={c.id}>
                <Link to={`/customer/${c.id}`} className="cust-row">
                  <span className={`avatar tone-${info.tone}`}>{initials(c.name)}</span>
                  <span className="cust-main">
                    <span className="cust-name">{c.name}</span>
                    <span className="cust-sub">{c.lastTxnDate ? `आख़िरी एंट्री ${relativeDay(c.lastTxnDate)}` : `+91 ${c.phone}`}</span>
                  </span>
                  <span className={`cust-bal c-${info.tone}`}>
                    <strong>{c.balance === 0 ? '₹0' : rupees(c.balance)}</strong>
                    <small>{info.label}</small>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <button className="fab" onClick={() => setAdding(true)}>
        <span aria-hidden="true">＋</span> नया ग्राहक
      </button>

      {adding && <CustomerForm title="नया ग्राहक जोड़ें" submitLabel="ग्राहक जोड़ें" onSubmit={addCustomer} onClose={() => setAdding(false)} />}
    </div>
  );
}
