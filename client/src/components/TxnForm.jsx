import { useState } from 'react';
import Modal from './Modal.jsx';
import { todayISO, rupees } from '../format.js';

export default function TxnForm({ customer, defaultType = 'udhar', onSubmit, onClose }) {
  const [type, setType] = useState(defaultType);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const num = Number(amount);
  const valid = /^\d+(\.\d{1,2})?$/.test(amount.trim()) && num > 0;
  const preview = valid ? customer.balance + (type === 'udhar' ? num : -num) : null;

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!valid) return setError('सही रक़म डालें (जैसे 250 या 99.50)');
    if (!date) return setError('तारीख़ चुनें');
    setBusy(true);
    try {
      await onSubmit({ type, amount: amount.trim(), date, note: note.trim() });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={`${customer.name} — नई एंट्री`} onClose={onClose}>
      <form onSubmit={submit} className="form" noValidate>
        <div className="segmented" role="radiogroup" aria-label="एंट्री का प्रकार">
          <button type="button" role="radio" aria-checked={type === 'udhar'} className={type === 'udhar' ? 'seg seg-due active' : 'seg'} onClick={() => setType('udhar')}>
            उधार दिया
          </button>
          <button type="button" role="radio" aria-checked={type === 'jama'} className={type === 'jama' ? 'seg seg-adv active' : 'seg'} onClick={() => setType('jama')}>
            जमा मिला
          </button>
        </div>

        <label className="field">
          <span>रक़म (₹)</span>
          <input className="amount-input" autoFocus value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" inputMode="decimal" maxLength={10} />
        </label>

        <div className="row-2">
          <label className="field">
            <span>तारीख़</span>
            <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>नोट (ज़रूरी नहीं)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="जैसे: राशन" maxLength={140} />
          </label>
        </div>

        {preview !== null && (
          <p className="preview">
            एंट्री के बाद: <strong className={preview > 0 ? 'c-due' : preview < 0 ? 'c-adv' : ''}>{rupees(preview)} {preview > 0 ? 'बाक़ी' : preview < 0 ? 'एडवांस' : '(हिसाब बराबर)'}</strong>
          </p>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className={`btn btn-block ${type === 'udhar' ? 'btn-due' : 'btn-adv'}`} disabled={busy}>
          {busy ? 'सेव हो रहा है…' : type === 'udhar' ? 'उधार सेव करें' : 'जमा सेव करें'}
        </button>
      </form>
    </Modal>
  );
}
