const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execFileSync } = require('child_process');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
before(async () => { mongod = await MongoMemoryServer.create(); });
after(async () => { await mongod.stop(); });

test('seed.js + server.js boot against a real database', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-boot-'));
  const logins = path.join(dataDir, 'logins.txt');
  const env = { ...process.env, NODE_ENV: 'production', MONGO_URI: mongod.getUri() + 'boot', DATA_DIR: dataDir, PORT: '5099', SEED_LOGINS_FILE: logins, SEED_PASSWORD: '' };
  const cwd = path.join(__dirname, '..');
  execFileSync(process.execPath, ['src/seed.js'], { cwd, env, stdio: 'pipe' });
  const text = fs.readFileSync(logins, 'utf8');
  assert.match(text, /guard\s+यूज़रनेम: guard/);
  const pw = text.match(/admin\s+यूज़रनेम: admin\s+पासवर्ड: (\S+)/)[1];
  assert.ok(pw.length >= 8, 'random password');

  const child = spawn(process.execPath, ['src/server.js'], { cwd, env });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (out += d));
  try {
    let ok = false;
    for (let i = 0; i < 40 && !ok; i++) {
      await new Promise((r) => setTimeout(r, 250));
      ok = await fetch('http://127.0.0.1:5099/api/health').then((r) => r.ok).catch(() => false);
    }
    assert.ok(ok, 'server did not start: ' + out);
    const r = await fetch('http://127.0.0.1:5099/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-sg-app': '1' }, body: JSON.stringify({ username: 'admin', password: pw }) });
    assert.equal(r.status, 200);
    const cookie = r.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/);
    const rep = await (await fetch('http://127.0.0.1:5099/api/reports/today', { headers: { cookie: cookie.split(';')[0] } })).json();
    assert.equal(rep.totals.total, 40, '40 fake students');
  } finally {
    child.kill('SIGTERM');
  }
});
