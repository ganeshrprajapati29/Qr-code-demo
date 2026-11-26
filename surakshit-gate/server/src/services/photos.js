const fs = require('fs/promises');
const path = require('path');
const config = require('../config');
const HttpError = require('../utils/httpError');
const { randomToken } = require('../utils/crypto');

const MAX_BYTES = 1.5 * 1024 * 1024;
const TYPES = [
  { ext: 'jpg', mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'png', mime: 'image/png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'webp', mime: 'image/webp', test: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
];
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', svg: 'image/svg+xml' };

// dataUrl: "data:image/jpeg;base64,...."
function decodeImage(dataUrl) {
  if (typeof dataUrl !== 'string') throw new HttpError(400, 'फोटो नहीं मिली');
  const m = dataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw new HttpError(400, 'फोटो JPG/PNG होनी चाहिए');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_BYTES) throw new HttpError(400, 'फोटो बहुत बड़ी है (1.5 MB तक)');
  const type = TYPES.find((t) => t.test(buf));
  if (!type) throw new HttpError(400, 'फोटो फ़ाइल सही नहीं है');
  return { buf, ext: type.ext };
}

async function saveImage(kind, dataUrl) {
  const { buf, ext } = decodeImage(dataUrl);
  const dir = config.dirs[kind];
  await fs.mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${randomToken(12)}.${ext}`;
  await fs.writeFile(path.join(dir, name), buf, { mode: 0o640 });
  return name;
}

async function saveRaw(kind, name, content) {
  const dir = config.dirs[kind];
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), content, { mode: 0o640 });
  return name;
}

function filePath(kind, name) {
  if (!name || !/^[A-Za-z0-9_.-]+$/.test(name) || name.includes('..')) return null;
  return path.join(config.dirs[kind], name);
}

async function removeImage(kind, name) {
  const p = filePath(kind, name);
  if (p) await fs.rm(p, { force: true });
}

async function sendImage(res, kind, name) {
  const p = filePath(kind, name);
  if (!p) throw new HttpError(404, 'फोटो नहीं मिली');
  try {
    await fs.access(p);
  } catch {
    throw new HttpError(404, 'फोटो नहीं मिली');
  }
  res.setHeader('Content-Type', MIME[path.extname(p).slice(1)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(p);
}

module.exports = { saveImage, saveRaw, removeImage, sendImage, decodeImage };
