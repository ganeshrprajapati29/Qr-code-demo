import QRCode from 'qrcode';

// Credit-card size ID cards (85.6 x 54 mm), 10 per A4 page.
// Cards are drawn on a canvas (browsers shape Hindi text correctly) and placed in the PDF as images.
const MM = 11.81; // px per mm at 300 dpi
const W = Math.round(85.6 * MM);
const H = Math.round(54 * MM);

async function loadImage(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) return null;
    const blobUrl = URL.createObjectURL(await res.blob());
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = blobUrl;
    });
    return { img, done: () => URL.revokeObjectURL(blobUrl) };
  } catch {
    return null;
  }
}

function fit(g, text, max) {
  let t = String(text || '');
  if (g.measureText(t).width <= max) return t;
  while (t.length > 1 && g.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export async function drawCard(student, school) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const font = (w, px) => `${w} ${px}px Mukta, "Noto Sans Devanagari", sans-serif`;

  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  // header band
  g.fillStyle = '#14213d';
  g.fillRect(0, 0, W, 130);
  g.fillStyle = '#f2b705';
  g.fillRect(0, 130, W, 10);
  g.fillStyle = '#ffffff';
  g.font = font(800, 52);
  g.textBaseline = 'middle';
  g.fillText(fit(g, school.name, W - 80), 40, 62);
  g.font = font(600, 28);
  g.fillStyle = '#f2b705';
  g.fillText('छात्र पहचान पत्र · सुरक्षित गेट', 40, 108);

  // photo
  const px = 40, py = 175, pw = 250, ph = 300;
  g.fillStyle = '#e8ebf2';
  roundRect(g, px, py, pw, ph, 18);
  g.fill();
  const photo = await loadImage(student.photoUrl);
  if (photo) {
    g.save();
    roundRect(g, px, py, pw, ph, 18);
    g.clip();
    const s = Math.max(pw / photo.img.width, ph / photo.img.height);
    const dw = photo.img.width * s;
    const dh = photo.img.height * s;
    g.drawImage(photo.img, px + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh);
    g.restore();
    photo.done();
  } else {
    g.fillStyle = '#8a94ab';
    g.font = font(600, 30);
    g.textAlign = 'center';
    g.fillText('फोटो', px + pw / 2, py + ph / 2);
    g.textAlign = 'left';
  }

  // QR (content is a random token: no name / number inside)
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, student.qr, { width: 330, margin: 1, errorCorrectionLevel: 'M' });
  const qx = W - 330 - 36, qy = 160;
  g.drawImage(qr, qx, qy, 330, 330);

  // text
  const tx = px + pw + 34;
  const tw = qx - tx - 20;
  g.fillStyle = '#14213d';
  g.font = font(800, 54);
  g.fillText(fit(g, student.name, tw), tx, 215);
  g.font = font(600, 38);
  g.fillStyle = '#334';
  g.fillText(fit(g, `क्लास: ${student.className}`, tw), tx, 285);
  if (student.rollNo) g.fillText(fit(g, `रोल: ${student.rollNo}`, tw), tx, 340);
  g.font = font(400, 26);
  g.fillStyle = '#667';
  g.fillText(fit(g, `कार्ड नं. ${student.cardVersion}`, tw), tx, 400);

  // footer
  g.fillStyle = '#f4f5f8';
  g.fillRect(0, H - 95, W, 95);
  g.fillStyle = '#445';
  g.font = font(400, 26);
  g.fillText(fit(g, `यह कार्ड मिले तो स्कूल को लौटाएँ${school.officePhone ? ` · फोन ${school.officePhone}` : ''}`, W - 80), 40, H - 48);
  // border
  g.strokeStyle = '#c9cfdc';
  g.lineWidth = 4;
  g.strokeRect(2, 2, W - 4, H - 4);
  return c;
}

export async function downloadCardsPdf(students, filename = 'qr-cards.pdf', onProgress = () => {}) {
  const [{ jsPDF }, me] = await Promise.all([import('jspdf'), fetch('/api/auth/me', { credentials: 'same-origin' }).then((r) => r.json())]);
  await document.fonts.load('800 40px Mukta');
  await document.fonts.load('600 40px Mukta');
  const school = me.school || { name: 'स्कूल' };
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const cw = 85.6, ch = 54, gapX = 6, gapY = 3;
  const mx = (210 - 2 * cw - gapX) / 2;
  const my = (297 - 5 * ch - 4 * gapY) / 2;
  for (let i = 0; i < students.length; i++) {
    if (i > 0 && i % 10 === 0) pdf.addPage();
    const slot = i % 10;
    const x = mx + (slot % 2) * (cw + gapX);
    const y = my + Math.floor(slot / 2) * (ch + gapY);
    const canvas = await drawCard(students[i], school);
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', x, y, cw, ch, undefined, 'FAST');
    onProgress(i + 1, students.length);
  }
  pdf.save(filename);
}
