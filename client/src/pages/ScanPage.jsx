import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { api } from '../api.js';
import { rupees, balanceInfo, relativeDay } from '../format.js';
import { makeQrDataUrl, downloadDataUrl } from '../qrImage.js';
import { useToast } from '../components/Toast.jsx';

const READER_ID = 'qr-reader';
const FILE_READER_ID = 'qr-file-reader';
const SCAN_CONFIG = { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false };

function cameraError(err) {
  const s = String(err?.name || err?.message || err);
  if (!window.isSecureContext) return 'कैमरा सिर्फ़ https:// वाले लिंक पर चलता है।';
  if (/NotAllowed|Permission/i.test(s)) return 'कैमरा की इजाज़त नहीं मिली। ब्राउज़र की सेटिंग में इस साइट को Camera की अनुमति दें और फिर “कैमरा चालू करें” दबाएँ।';
  if (/NotFound|Requested device not found|no camera/i.test(s)) return 'इस डिवाइस में कैमरा नहीं मिला। “फ़ोटो से स्कैन” इस्तेमाल करें।';
  if (/NotReadable|in use|Could not start/i.test(s)) return 'कैमरा किसी दूसरे ऐप में चल रहा है। उसे बंद करके दोबारा कोशिश करें।';
  return 'कैमरा चालू नहीं हो पाया। “फ़ोटो से स्कैन” से कोशिश करें।';
}

export default function ScanPage() {
  const toast = useToast();
  const scanner = useRef(null);
  const handled = useRef(false);
  const fileInput = useRef(null);
  const [state, setState] = useState('idle'); // idle | starting | scanning | resolving | result
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [scans, setScans] = useState(null);

  const loadScans = useCallback(() => {
    api.recentScans(8).then((r) => setScans(r.scans)).catch(() => setScans([]));
  }, []);

  const stopCamera = useCallback(async () => {
    const s = scanner.current;
    scanner.current = null;
    if (s) {
      try {
        if (s.isScanning) await s.stop();
        s.clear();
      } catch {
        /* already stopped */
      }
    }
  }, []);

  useEffect(() => {
    loadScans();
    return () => {
      stopCamera();
    };
  }, [loadScans, stopCamera]);

  const resolve = useCallback(
    async (text) => {
      setState('resolving');
      if (navigator.vibrate) navigator.vibrate(120);
      try {
        const r = await api.resolveQr(text);
        setResult({ ok: true, ...r });
      } catch (e) {
        setResult({ ok: false, message: e.message, raw: text });
      }
      setState('result');
      loadScans();
    },
    [loadScans]
  );

  async function startCamera() {
    setError('');
    setResult(null);
    setState('starting');
    handled.current = false;
    await stopCamera();
    try {
      const s = new Html5Qrcode(READER_ID, SCAN_CONFIG);
      scanner.current = s;
      await s.start(
        { facingMode: 'environment' },
        { fps: 12, qrbox: (w, h) => { const n = Math.floor(Math.min(w, h) * 0.72); return { width: n, height: n }; } },
        async (text) => {
          if (handled.current) return;
          handled.current = true;
          await stopCamera();
          resolve(text);
        },
        () => {}
      );
      setState('scanning');
    } catch (err) {
      await stopCamera();
      setError(cameraError(err));
      setState('idle');
    }
  }

  async function stop() {
    await stopCamera();
    setState('idle');
  }

  async function scanPhoto(file) {
    if (!file) return;
    await stopCamera();
    setError('');
    setResult(null);
    setState('resolving');
    const s = new Html5Qrcode(FILE_READER_ID, SCAN_CONFIG);
    try {
      const text = await s.scanFile(file, false);
      resolve(text);
    } catch {
      setError('इस फ़ोटो में QR कोड नहीं मिला। साफ़ और पास से ली गई फ़ोटो चुनें।');
      setState('idle');
    } finally {
      try { s.clear(); } catch { /* noop */ }
    }
  }

  async function clearHistory() {
    if (!confirm('स्कैन हिस्ट्री मिटाएँ?')) return;
    await api.clearScans().catch(() => {});
    toast('हिस्ट्री मिटा दी गई');
    loadScans();
  }

  const scanning = state === 'scanning' || state === 'starting';

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">QR स्कैनर</p>
          <h1>QR स्कैन करें</h1>
        </div>
      </header>

      {state !== 'result' && (
        <section className="card scan-card">
          <div className={`viewer ${scanning ? 'live' : ''}`}>
            <div id={READER_ID} />
            {!scanning && state !== 'resolving' && (
              <div className="viewer-ph">
                <svg viewBox="0 0 24 24" width="56" height="56" aria-hidden="true"><path fill="currentColor" d="M4 4h5V2H2v7h2V4Zm11-2v2h5v5h2V2h-7ZM4 15H2v7h7v-2H4v-5Zm16 5h-5v2h7v-7h-2v5ZM7 7h4v4H7V7Zm6 0h4v4h-4V7Zm-6 6h4v4H7v-4Zm8 0h2v2h-2v-2Zm-2 2h2v2h-2v-2Z" /></svg>
                <p>ग्राहक का QR कार्ड या नाम वाला कोई भी QR स्कैन करें</p>
              </div>
            )}
            {state === 'resolving' && (
              <div className="viewer-ph"><div className="spinner" /><p>पढ़ा जा रहा है…</p></div>
            )}
          </div>

          {scanning ? (
            <button className="btn btn-outline btn-block mt" onClick={stop}>कैमरा बंद करें</button>
          ) : (
            <button className="btn btn-primary btn-block mt" onClick={startCamera} disabled={state === 'resolving'}>
              📷 कैमरा चालू करें
            </button>
          )}
          <button className="btn btn-ghost btn-block" onClick={() => fileInput.current?.click()} disabled={state === 'resolving'}>
            🖼 फ़ोटो से स्कैन करें
          </button>
          <p className={error ? 'scan-status err' : 'scan-status'} role="status">
            {error || (state === 'scanning' ? 'QR को चौकोर के अंदर रखें…' : state === 'starting' ? 'कैमरा चालू हो रहा है…' : '')}
          </p>
        </section>
      )}

      {state === 'result' && result && <ScanResult result={result} onAgain={startCamera} onPhoto={() => fileInput.current?.click()} />}

      <div id={FILE_READER_ID} hidden />
      <input ref={fileInput} type="file" accept="image/*" hidden data-testid="photo-input" onChange={(e) => { scanPhoto(e.target.files?.[0]); e.target.value = ''; }} />

      <RecentScans scans={scans} onClear={clearHistory} />
      <TestQrMaker />
    </div>
  );
}

function ScanResult({ result, onAgain, onPhoto }) {
  if (!result.ok) {
    return (
      <section className="card result-card">
        <div className="result-icon bad">!</div>
        <p className="result-label">QR पढ़ लिया, पर…</p>
        <p className="result-msg">{result.message}</p>
        <button className="btn btn-primary btn-block mt" onClick={onAgain}>फिर से स्कैन करें</button>
        <button className="btn btn-ghost btn-block" onClick={onPhoto}>🖼 फ़ोटो से स्कैन करें</button>
      </section>
    );
  }
  const c = result.customer;
  const info = c ? balanceInfo(c.balance) : null;
  return (
    <section className="card result-card" aria-live="polite">
      <div className="result-icon">✓</div>
      <p className="result-label">{c ? 'ग्राहक' : result.kind === 'link' ? 'लिंक' : 'नाम'}</p>
      <h2 className="result-name" data-testid="scan-name">{result.name}</h2>
      {c && (
        <>
          <p className="result-sub">+91 {c.phone}</p>
          <div className={`result-balance tone-${info.tone}`}>
            <strong>{rupees(c.balance)}</strong> <span>{info.label}</span>
          </div>
          <Link to={`/customer/${c.id}`} className="btn btn-primary btn-block mt">खाता खोलें →</Link>
        </>
      )}
      {result.kind === 'link' && (
        <a className="btn btn-outline btn-block mt" href={result.name} target="_blank" rel="noopener noreferrer">लिंक खोलें ↗</a>
      )}
      <div className="row-2 mt">
        <button className={c ? 'btn btn-outline' : 'btn btn-primary'} onClick={onAgain}>📷 फिर से स्कैन</button>
        <button className="btn btn-outline" onClick={onPhoto}>🖼 फ़ोटो से</button>
      </div>
    </section>
  );
}

function RecentScans({ scans, onClear }) {
  if (!scans || scans.length === 0) return null;
  return (
    <section className="mt-lg">
      <div className="section-head">
        <h2 className="section-title">हाल के स्कैन</h2>
        <button className="link-btn small" onClick={onClear}>मिटाएँ</button>
      </div>
      <ul className="list">
        {scans.map((s) => {
          const body = (
            <>
              <span className={`scan-kind k-${s.kind}`}>{s.kind === 'customer' ? '👤' : s.kind === 'link' ? '🔗' : s.kind === 'unknown' ? '⚠️' : '🏷'}</span>
              <span className="cust-main">
                <span className="cust-name">{s.name}</span>
                <span className="cust-sub">{relativeDay(s.createdAt)} · {new Date(s.createdAt).toLocaleTimeString('hi-IN', { hour: 'numeric', minute: '2-digit' })}</span>
              </span>
              {s.customerId && <span aria-hidden="true" className="chev">›</span>}
            </>
          );
          return (
            <li key={s.id}>
              {s.customerId ? <Link to={`/customer/${s.customerId}`} className="cust-row">{body}</Link> : <div className="cust-row">{body}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TestQrMaker() {
  const [name, setName] = useState('');
  const [img, setImg] = useState('');

  async function make(e) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setImg(await makeQrDataUrl(JSON.stringify({ name: n })));
  }

  return (
    <details className="card test-qr mt-lg">
      <summary>🧪 टेस्ट के लिए किसी भी नाम का QR बनाएँ</summary>
      <form onSubmit={make} className="test-qr-form">
        <input value={name} onChange={(e) => { setName(e.target.value); setImg(''); }} placeholder="जैसे: राहुल शर्मा" maxLength={60} aria-label="नाम" />
        <button className="btn btn-primary" disabled={!name.trim()}>QR बनाएँ</button>
      </form>
      {img && (
        <div className="test-qr-out">
          <img src={img} alt={`${name} का QR`} />
          <p className="hint center">इसे दूसरे फ़ोन/स्क्रीन पर खोलकर ऊपर से स्कैन करें।</p>
          <button className="btn btn-outline" onClick={() => downloadDataUrl(img, `qr-${name.trim().replace(/\s+/g, '-')}.png`)}>⬇ डाउनलोड</button>
        </div>
      )}
    </details>
  );
}
