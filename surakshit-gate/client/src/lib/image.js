// Resize any image (file or canvas) to a JPEG data URL – keeps uploads small on slow networks.
export async function fileToDataUrl(file, max = 720, quality = 0.82) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('फोटो खुल नहीं पाई'));
      i.src = url;
    });
    return drawScaled(img, img.naturalWidth, img.naturalHeight, max, quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function videoToDataUrl(video, max = 720, quality = 0.82) {
  return drawScaled(video, video.videoWidth, video.videoHeight, max, quality);
}

function drawScaled(src, w, h, max, quality) {
  const scale = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

export function beep(ok = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = ok ? 880 : 220;
    g.gain.value = 0.08;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + (ok ? 0.12 : 0.35));
    setTimeout(() => ctx.close(), 600);
  } catch {
    /* no audio */
  }
  if (navigator.vibrate) navigator.vibrate(ok ? 80 : [120, 60, 120]);
}
