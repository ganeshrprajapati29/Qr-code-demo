import jsQR from 'jsqr';

// Uses the phone's built-in BarcodeDetector when available (fast, Android Chrome),
// otherwise jsQR (works everywhere, incl. iPhone Safari).
let native = null;
async function nativeDetector() {
  if (native !== null) return native;
  try {
    if ('BarcodeDetector' in window && (await window.BarcodeDetector.getSupportedFormats()).includes('qr_code')) {
      native = new window.BarcodeDetector({ formats: ['qr_code'] });
      return native;
    }
  } catch { /* not supported */ }
  native = false;
  return native;
}

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

function jsqrFrom(source, w, h, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data || null;
}

// one video frame -> text | null
export async function decodeVideo(video) {
  if (!video.videoWidth) return null;
  const det = await nativeDetector();
  if (det) {
    try {
      const r = await det.detect(video);
      if (r[0]?.rawValue) return r[0].rawValue;
      return null;
    } catch { /* fall back */ }
  }
  return jsqrFrom(video, video.videoWidth, video.videoHeight, 720);
}

// photo file -> text | null (tries a few sizes: big photos of small cards need it)
export async function decodeFile(file) {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return null;
  try {
    const det = await nativeDetector();
    if (det) {
      try {
        const r = await det.detect(bmp);
        if (r[0]?.rawValue) return r[0].rawValue;
      } catch { /* fall back */ }
    }
    for (const side of [1000, 1600, 700, 2400]) {
      const t = jsqrFrom(bmp, bmp.width, bmp.height, side);
      if (t) return t;
    }
    return null;
  } finally {
    bmp.close?.();
  }
}
