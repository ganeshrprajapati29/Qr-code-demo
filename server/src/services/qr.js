// Understands what a scanned QR code contains.
//  - our customer cards:  https://<site>/c/<token>   or   UK:<token>
//  - JSON:                {"name":"Rahul"}
//  - key/value:           name: Rahul
//  - any other text:      shown as-is
const TOKEN = '[A-Za-z0-9_-]{6,32}';
const URL_TOKEN = new RegExp(`/c/(${TOKEN})(?:[/?#]|$)`);
const PREFIX_TOKEN = new RegExp(`^UK:(${TOKEN})$`);

function parseQr(raw) {
  const text = String(raw).trim();

  const m = text.match(PREFIX_TOKEN) || (/^https?:\/\//i.test(text) ? text.match(URL_TOKEN) : null);
  if (m) return { kind: 'customer', token: m[1] };

  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      const n = obj.name ?? obj.Name ?? obj.NAME ?? obj.fullName ?? obj.full_name;
      if (n !== undefined && n !== null && String(n).trim()) return { kind: 'text', name: clip(String(n)) };
    }
  } catch {
    /* not JSON */
  }

  const kv = text.match(/^\s*(?:name|naam|नाम)\s*[:=]\s*(.+)$/im);
  if (kv) return { kind: 'text', name: clip(kv[1]) };

  if (/^https?:\/\/\S+$/i.test(text)) return { kind: 'link', name: clip(text) };
  if (/^(BEGIN:VCARD)/i.test(text)) {
    const fn = text.match(/^FN[^:]*:(.+)$/im);
    if (fn) return { kind: 'text', name: clip(fn[1]) };
  }
  return { kind: 'text', name: clip(text) };
}

function clip(s) {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > 160 ? t.slice(0, 157) + '…' : t;
}

module.exports = { parseQr };
