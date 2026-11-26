const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { translate, FIELDS } = require('../src/i18n');

// Every Hindi message the server can send to the screen must have an English version.
test('every server message has an English translation', () => {
  const skip = ['texts.js', 'alerts.js', 'seed.js', 'csv.js', 'i18n.js', 'Setting.js'];
  const files = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') && !skip.includes(e.name) && files.push(path.join(d, e.name))));
  walk(path.join(__dirname, '..', 'src'));
  const missing = [];
  for (const f of files) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/'([^'\n]*[ऀ-ॿ][^'\n]*)'/g)) {
      const s = m[1];
      if (FIELDS[s] || s.includes('`') || s.startsWith('${')) continue; // template parts are covered by patterns
      if (translate(s, 'en') === s) missing.push(`${path.basename(f)}: ${s}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('dynamic messages are translated', () => {
  assert.equal(translate('बच्चे का नाम भरें', 'en'), "Please enter child's name");
  assert.equal(translate('परेड गिनती 0 से 500 के बीच की संख्या हो', 'en'), 'Parade count must be a number from 0 to 500');
  assert.equal(translate('OTP गलत है। बच्चे को न सौंपें। (2/5)', 'en'), 'Wrong OTP. Do NOT hand over the child. (2/5)');
  assert.equal(translate('बार-बार गलत पासवर्ड। यह लॉगिन 14 मिनट के लिए बंद है।', 'en'), 'Too many wrong passwords. This login is locked for 14 minutes.');
  assert.equal(translate('बच्चा नहीं मिला', 'hi'), 'बच्चा नहीं मिला');
});
