import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '../api.js';
import { useToast } from './Toast.jsx';

export default function ReminderSheet({ customer, apiEnabled, onClose, onSent }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [apiResult, setApiResult] = useState(null);

  useEffect(() => {
    api.reminder(customer.id).then(setData).catch((e) => setError(e.message));
  }, [customer.id]);

  async function openLink(url) {
    window.open(url, '_blank', 'noopener');
    api.logReminder(customer.id).then(onSent).catch(() => {});
  }

  async function sendViaApi() {
    setSending(true);
    setApiResult(null);
    try {
      await api.sendReminder(customer.id);
      setApiResult({ ok: true, text: 'मैसेज WhatsApp API से भेज दिया गया ✅' });
      toast('मैसेज भेज दिया गया');
      onSent();
    } catch (e) {
      setApiResult({ ok: false, text: e.message });
    } finally {
      setSending(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(data.text);
      toast('मैसेज कॉपी हो गया');
    } catch {
      toast('कॉपी नहीं हो पाया', 'err');
    }
  }

  return (
    <Modal title="याद दिलाने वाला मैसेज" onClose={onClose}>
      {error && <p className="form-error">{error}</p>}
      {!data && !error && <div className="skeleton" style={{ height: 90 }} />}
      {data && (
        <>
          <div className="msg-preview">
            <div className="msg-bubble">{data.text}</div>
            <button className="link-btn" onClick={copy}>मैसेज कॉपी करें</button>
          </div>

          <div className="reminder-actions">
            <button className="btn btn-wa btn-block" onClick={() => openLink(data.whatsappUrl)}>
              <WaIcon /> WhatsApp पर भेजें
            </button>
            <button className="btn btn-outline btn-block" onClick={() => openLink(data.smsUrl)}>
              ✉️ SMS भेजें
            </button>
            <p className="hint">ये दोनों बटन आपके फ़ोन का WhatsApp / SMS ऐप खोलते हैं, मैसेज पहले से लिखा होता है — बस “भेजें” दबाएँ। <strong>कोई ख़र्च नहीं।</strong></p>

            <div className="divider"><span>या</span></div>

            <button className="btn btn-primary btn-block" onClick={sendViaApi} disabled={sending}>
              {sending ? 'भेजा जा रहा है…' : '⚡ ऑटोमैटिक भेजें (WhatsApp Cloud API)'}
            </button>
            {!apiEnabled && !apiResult && (
              <p className="hint">ऑटोमैटिक भेजने के लिए WhatsApp Business API चालू करनी होगी — नीचे देखें।</p>
            )}
            {apiResult && <p className={apiResult.ok ? 'notice notice-ok' : 'notice notice-warn'} role="alert">{apiResult.text}</p>}
          </div>

          <details className="cost-box" open={apiResult && !apiResult.ok}>
            <summary>ऑटोमैटिक मैसेज के लिए क्या लगेगा? (ख़र्च)</summary>
            <table>
              <thead>
                <tr><th>तरीक़ा</th><th>सेवा</th><th>अनुमानित ख़र्च</th></tr>
              </thead>
              <tbody>
                <tr><td>WhatsApp बटन (अभी चालू)</td><td>wa.me लिंक</td><td>₹0 — दुकानदार ख़ुद “भेजें” दबाता है</td></tr>
                <tr><td>SMS बटन (अभी चालू)</td><td>फ़ोन का SMS</td><td>आपके मोबाइल प्लान के अनुसार</td></tr>
                <tr><td>ऑटोमैटिक WhatsApp</td><td>Meta WhatsApp Cloud API</td><td>लगभग ₹0.12–0.15 प्रति मैसेज (Utility टेम्पलेट) + Meta बिज़नेस वेरिफ़िकेशन</td></tr>
                <tr><td>ऑटोमैटिक SMS</td><td>MSG91 / Fast2SMS आदि</td><td>लगभग ₹0.15–0.25 प्रति SMS + DLT रजिस्ट्रेशन (TRAI नियम)</td></tr>
              </tbody>
            </table>
            <p className="hint">कोड में WhatsApp Cloud API पहले से जुड़ी है — सिर्फ़ Meta का टोकन और फ़ोन नंबर ID सर्वर पर डालना है। दरें Meta/प्रोवाइडर बदल सकते हैं, लाइव करने से पहले जाँच लें।</p>
          </details>
        </>
      )}
    </Modal>
  );
}

function WaIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}
