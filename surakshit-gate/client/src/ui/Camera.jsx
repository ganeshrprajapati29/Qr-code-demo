import { useEffect, useRef, useState } from 'react';
import { fileToDataUrl, videoToDataUrl } from '../lib/image.js';

// Takes a photo: live camera when possible, phone's camera app as fallback.
export default function Camera({ onPhoto, facing = 'environment' }) {
  const video = useRef(null);
  const stream = useRef(null);
  const fileInput = useRef(null);
  const [state, setState] = useState('starting'); // starting | live | error
  const [error, setError] = useState('');
  const [mode, setMode] = useState(facing);

  useEffect(() => {
    let alive = true;
    (async () => {
      setState('starting');
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode, width: { ideal: 1280 } }, audio: false });
        if (!alive) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        video.current.srcObject = s;
        await video.current.play();
        setState('live');
      } catch {
        if (alive) {
          setState('error');
          setError('लाइव कैमरा नहीं खुला। नीचे “फोन के कैमरे से फोटो लें” दबाएँ।');
        }
      }
    })();
    return () => {
      alive = false;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
  }, [mode]);

  function snap() {
    const v = video.current;
    if (!v?.videoWidth) return;
    onPhoto(videoToDataUrl(v));
  }

  async function fromFile(file) {
    if (!file) return;
    try {
      onPhoto(await fileToDataUrl(file));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="camera">
      <div className="viewer tall">
        <video ref={video} playsInline muted className={state === 'live' ? '' : 'hidden'} />
        {state !== 'live' && <div className="viewer-ph">{state === 'starting' ? <div className="spinner light" /> : <p>{error}</p>}</div>}
        {state === 'live' && (
          <button className="cam-flip" onClick={() => setMode(mode === 'environment' ? 'user' : 'environment')} aria-label="कैमरा बदलें">⟲</button>
        )}
      </div>
      {state === 'live' && <button className="shutter" onClick={snap} aria-label="फोटो खींचो"><span /></button>}
      <button className="btn btn-outline btn-block mt" onClick={() => fileInput.current?.click()}>📷 फोन के कैमरे से फोटो लें</button>
      <input ref={fileInput} type="file" accept="image/*" capture={facing} hidden data-testid="camera-file" onChange={(e) => { fromFile(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}
