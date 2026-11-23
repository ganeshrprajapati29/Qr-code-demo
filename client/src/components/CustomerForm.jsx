import { useState } from 'react';
import Modal from './Modal.jsx';

export default function CustomerForm({ initial, title, submitLabel, onSubmit, onClose }) {
  const [name, setName] = useState(initial?.name || '');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    const digits = phone.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
    if (name.trim().length < 2) return setError('ग्राहक का नाम डालें');
    if (!/^[6-9]\d{9}$/.test(digits)) return setError('सही 10 अंकों का मोबाइल नंबर डालें');
    setBusy(true);
    try {
      await onSubmit({ name: name.trim(), phone: digits });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="form" noValidate>
        <label className="field">
          <span>ग्राहक का नाम</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="जैसे: रमेश कुमार" maxLength={80} autoComplete="off" />
        </label>
        <label className="field">
          <span>मोबाइल नंबर</span>
          <div className="phone-input">
            <span>+91</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" inputMode="tel" maxLength={16} autoComplete="off" />
          </div>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'सेव हो रहा है…' : submitLabel}</button>
      </form>
    </Modal>
  );
}
