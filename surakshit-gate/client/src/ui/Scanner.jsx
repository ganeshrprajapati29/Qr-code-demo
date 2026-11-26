import { useCallback, useEffect, useRef, useState } from 'react';
import { decodeFile, decodeVideo } from '../lib/qrdecode.js';

function cameraError(err) {
  const s = String(err?.name || err?.message || err);
  if (!window.isSecureContext) return 'कैमरा सिर्फ https:// लिंक पर चलता है।';
  if (/NotAllowed|Permission/i.test(s)) return 'कैमरा की इजाज़त नहीं मिली। ब्राउज़र सेटिंग में इस साइट को Camera की अनुमति दें।';
  if (/NotFound|Overconstrained/i.test(s)) return 'इस फोन में कैमरा नहीं मिला। “फोटो से” इस्तेमाल करें।';
  if (/NotReadable|in use|Could not start/i.test(s)) return 'कैमरा किसी दूसरे ऐप में चल रहा है। उसे बंद करके फिर कोशिश करें।';
  return 'कैमरा चालू नहीं हुआ। “फोटो से” से कोशिश करें।';
}

// Continuous QR scanner. Calls onCode(text) for each new code (same code ignored for `cooldownMs`).
export default function Scanner({ onCode, cooldownMs = 4000 }) {
  const video = useRef(null);
  const stream = useRef(null);
  const loop = useRef(0);
  const last = useRef({ code: '', at: 0 });
  const cb = useRef(onCode);
  cb.current = onCode;
  const fileInput = useRef(null);
  const [state, setState] = useState('off'); // off | starting | on
  const [error, setError] = useState('');

  const emit = useCallback((text) => {
    const now = Date.now();
    if (text === last.current.code && now - last.current.at < cooldownMs) return;
    last.current = { code: text, at: now };
    cb.current(text);
  }, [cooldownMs]);

  const stop = useCallback(() => {
    clearTimeout(loop.current);
    loop.current = 0;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setState('off');
  }, []);

  const tick = useCallback(async () => {
    if (!stream.current) return;
    try {
      const text = await decodeVideo(video.current);
      if (text) emit(text);
    } catch { /* keep scanning */ }
    if (stream.current) loop.current = setTimeout(tick, 120);
  }, [emit]);

  const start = useCallback(async () => {
    setError('');
    stop();
    setState('starting');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      stream.current = s;
      video.current.srcObject = s;
      await video.current.play();
      setState('on');
      tick();
    } catch (e) {
      stop();
      setError(cameraError(e));
    }
  }, [stop, tick]);

  useEffect(() => stop, [stop]);
  // pause the camera when the app goes to background (saves battery)
  useEffect(() => {
    const onHide = () => document.hidden && stream.current && stop();
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [stop]);

  async function scanFile(file) {
    if (!file) return;
    setError('');
    const text = await decodeFile(file).catch(() => null);
    if (!text) return setError('इस फोटो में QR नहीं मिला। कार्ड की साफ़, पास से फोटो लें।');
    last.current = { code: '', at: 0 };
    emit(text);
  }

  return (
    <div className="scanner">
      <div className={`viewer ${state === 'on' ? 'live' : ''}`}>
        <video ref={video} playsInline muted className={state === 'on' ? '' : 'hidden'} />
        {state === 'on' && <div className="scan-frame" aria-hidden="true" />}
        {state !== 'on' && (
          <div className="viewer-ph">
            {state === 'starting' ? <div className="spinner light" /> : (
              <svg viewBox="0 0 24 24" width="54" height="54" aria-hidden="true"><path fill="currentColor" d="M4 4h5V2H2v7h2V4Zm11-2v2h5v5h2V2h-7ZM4 15H2v7h7v-2H4v-5Zm16 5h-5v2h7v-7h-2v5ZM7 7h4v4H7V7Zm6 0h4v4h-4V7Zm-6 6h4v4H7v-4Zm8 0h2v2h-2v-2Zm-2 2h2v2h-2v-2Z" /></svg>
            )}
            <p>{state === 'starting' ? 'कैमरा चालू हो रहा है…' : 'बच्चे का कार्ड कैमरे के सामने रखें'}</p>
          </div>
        )}
      </div>
      <div className="row gap mt">
        {state === 'on' ? (
          <button className="btn btn-outline grow" onClick={stop}>⏸ कैमरा रोकें</button>
        ) : (
          <button className="btn btn-primary grow" onClick={start} disabled={state === 'starting'}>📷 कैमरा चालू करें</button>
        )}
        <button className="btn btn-outline" onClick={() => fileInput.current?.click()} aria-label="फोटो से स्कैन">🖼 फोटो से</button>
      </div>
      <input ref={fileInput} type="file" accept="image/*" hidden data-testid="scan-file" onChange={(e) => { scanFile(e.target.files?.[0]); e.target.value = ''; }} />
      {error && <p className="alert alert-red mt" role="alert">{error}</p>}
    </div>
  );
}
