import QRCode from 'qrcode';

export function customerCardUrl(token) {
  return `${window.location.origin}/c/${token}`;
}

// Printable card: shop name, big QR, customer name.
export async function makeCardPng({ text, title, subtitle, footer }) {
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, text, { width: 520, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#111827', light: '#ffffff' } });

  const W = 640;
  const H = 860;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const font = (w, s) => `${w} ${s}px "Noto Sans Devanagari", system-ui, sans-serif`;

  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#4338ca';
  g.fillRect(0, 0, W, 96);
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.font = font(700, 34);
  g.fillText(fit(g, title, W - 60), W / 2, 60);

  g.drawImage(qr, (W - 520) / 2, 130);

  g.fillStyle = '#111827';
  g.font = font(800, 44);
  g.fillText(fit(g, subtitle, W - 60), W / 2, 715);
  g.fillStyle = '#6b7280';
  g.font = font(500, 24);
  g.fillText(fit(g, footer, W - 60), W / 2, 770);
  return c.toDataURL('image/png');
}

export async function makeQrDataUrl(text) {
  return QRCode.toDataURL(text, { width: 480, margin: 2, errorCorrectionLevel: 'M' });
}

function fit(g, text, max) {
  let t = String(text || '');
  if (g.measureText(t).width <= max) return t;
  while (t.length > 1 && g.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function shareDataUrl(dataUrl, filename, text) {
  const [meta, b64] = dataUrl.split(',');
  const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
  const blob = new Blob([bytes], { type: meta.slice(5, meta.indexOf(';')) || 'image/png' });
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], text });
    return true;
  }
  return false;
}
