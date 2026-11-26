// Fails if any Hindi text used in the app has no English translation (or placeholders differ).
import fs from 'node:fs';
import path from 'node:path';
import EN from '../src/i18n/en.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../src');
const RAW_TABLE_FILES = ['format.js', 'More.jsx', 'Layout.jsx', 'Messages.jsx', 'NewPickup.jsx', 'Pickups.jsx'];
const SERVER_TEXTS = ['नंबर गलत या बंद है', 'मैसेज नहीं पहुँचा', 'नंबर पर मैसेज नहीं पहुँचा (डेमो: नंबर बंद/गलत)'];
const DEV = /[ऀ-ॿ]/;
const keys = new Set(SERVER_TEXTS);
const unwrapped = [];
const noImport = [];

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'i18n') walk(p); continue; }
    if (!/\.(jsx?|mjs)$/.test(e.name)) continue;
    const src = fs.readFileSync(p, 'utf8');
    if (/(?<![\w.])t\(/.test(src) && !/import \{[^}]*\bt\b[^}]*\} from '[./]+i18n\.jsx'/.test(src) && e.name !== 'i18n.jsx') noImport.push(path.relative(ROOT, p));
    for (const m of src.matchAll(/(?<![\w.])t\('((?:[^'\\]|\\.)*)'/g)) keys.add(m[1].replace(/\\n/g, '\n').replace(/\\'/g, "'"));
    if (RAW_TABLE_FILES.includes(e.name)) for (const m of src.matchAll(/'([^'\n]*[ऀ-ॿ][^'\n]*)'/g)) keys.add(m[1]);
    // Hindi that is not inside t('...') (and not in a raw table file) is probably a missed string
    const stripped = src.replace(/(?<![\w.])t\('(?:[^'\\]|\\.)*'/g, "t(''");
    if (!RAW_TABLE_FILES.includes(e.name) && e.name !== 'i18n.jsx') {
      stripped.split('\n').forEach((line, i) => { if (DEV.test(line) && !/^\s*(\/\/|\{\/\*)/.test(line) && !/<option value="hi">/.test(line) && !/TEMPLATE =/.test(line)) unwrapped.push(`${path.relative(ROOT, p)}:${i + 1}: ${line.trim().slice(0, 100)}`); });
    }
  }
}
walk(ROOT);
const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
const missing = [...keys].filter((k) => DEV.test(k) && !(k in EN));
const badPh = [...keys].filter((k) => k in EN && ph(k) !== ph(EN[k]));
const unused = Object.keys(EN).filter((k) => !keys.has(k));
if (missing.length) console.log('Missing English:\n  ' + missing.join('\n  '));
if (badPh.length) console.log('Placeholder mismatch:\n  ' + badPh.join('\n  '));
if (unwrapped.length) console.log('Hindi not wrapped in t():\n  ' + unwrapped.join('\n  '));
if (noImport.length) console.log('Uses t() without importing it:\n  ' + noImport.join('\n  '));
if (unused.length) console.log(`(info) ${unused.length} unused keys`);
console.log(`${keys.size} texts checked`);
process.exit(missing.length || badPh.length || unwrapped.length || noImport.length ? 1 : 0);
