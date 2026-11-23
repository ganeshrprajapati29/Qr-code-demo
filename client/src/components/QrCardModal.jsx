import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '../api.js';
import { useToast } from './Toast.jsx';
import { customerCardUrl, makeCardPng, downloadDataUrl, shareDataUrl } from '../qrImage.js';

export default function QrCardModal({ customer, shopName, onClose, onChanged }) {
  const toast = useToast();
  const [img, setImg] = useState('');
  const [busy, setBusy] = useState(false);
  const fileName = `qr-card-${customer.phone}.png`;

  useEffect(() => {
    let alive = true;
    makeCardPng({
      text: customerCardUrl(customer.qrToken),
      title: shopName || 'उधार खाता',
      subtitle: customer.name,
      footer: 'स्कैन करें — अपना हिसाब देखें',
    }).then((url) => alive && setImg(url));
    return () => {
      alive = false;
    };
  }, [customer.qrToken, customer.name, shopName]);

  async function share() {
    try {
      const shared = await shareDataUrl(img, fileName, `${customer.name} का QR कार्ड`);
      if (!shared) {
        downloadDataUrl(img, fileName);
        toast('इस फ़ोन पर शेयर नहीं हो सकता — कार्ड डाउनलोड कर दिया');
      }
    } catch (e) {
      if (e.name !== 'AbortError') toast('शेयर नहीं हो पाया', 'err');
    }
  }

  async function regenerate() {
    if (!confirm('नया QR बनाने पर पुराना छपा हुआ कार्ड काम नहीं करेगा। आगे बढ़ें?')) return;
    setBusy(true);
    try {
      await api.regenerateQr(customer.id);
      toast('नया QR कार्ड बन गया');
      onChanged();
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="ग्राहक का QR कार्ड" onClose={onClose}>
      <div className="qr-card">
        {img ? <img src={img} alt={`${customer.name} का QR कार्ड`} /> : <div className="skeleton" style={{ aspectRatio: '640 / 860' }} />}
      </div>
      <p className="hint center">इस QR को “QR स्कैन” टैब से या फ़ोन के कैमरा ऐप से स्कैन करें — ग्राहक का नाम और बाक़ी तुरंत खुलेगा।</p>
      <div className="row-2" style={{ marginTop: 12 }}>
        <button className="btn btn-primary" onClick={() => downloadDataUrl(img, fileName)} disabled={!img}>⬇ डाउनलोड</button>
        <button className="btn btn-outline" onClick={share} disabled={!img}>↗ शेयर</button>
      </div>
      <button className="link-btn center-block" onClick={regenerate} disabled={busy}>
        {busy ? 'बन रहा है…' : 'कार्ड खो गया? नया QR बनाएँ'}
      </button>
    </Modal>
  );
}
