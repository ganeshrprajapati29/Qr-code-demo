import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

// Opened when a customer's QR card is scanned with the phone's normal camera app.
export default function CardRedirect() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api
      .resolveQr(window.location.href)
      .then((r) => alive && navigate(`/customer/${r.customer.id}`, { replace: true, state: { fromScan: true } }))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [navigate]);

  return (
    <div className="page">
      {error ? (
        <div className="empty">
          <p className="empty-title">QR कार्ड नहीं खुला</p>
          <p>{error}</p>
          <Link to="/" className="btn btn-primary">सभी ग्राहक देखें</Link>
        </div>
      ) : (
        <div className="empty">
          <div className="spinner" aria-hidden="true" />
          <p>ग्राहक का खाता खुल रहा है…</p>
        </div>
      )}
    </div>
  );
}
