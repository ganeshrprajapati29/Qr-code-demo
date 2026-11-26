const fs = require('fs/promises');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const mongoose = require('mongoose');
const config = require('../config');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const { EJSON } = mongoose.mongo.BSON;

// everything except login sessions
const COLLECTIONS = ['users', 'students', 'attendances', 'pickups', 'messages', 'alerts', 'parades', 'settings', 'audits'];
const NAME_RE = /^\d{4}-\d{2}-\d{2}_\d{4}(-\d{2})?(_[a-z-]+)?$/;

function stamp(d = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: config.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(d);
  const g = (t) => p.find((x) => x.type === t).value;
  return `${g('year')}-${g('month')}-${g('day')}_${g('hour')}${g('minute')}-${g('second')}`;
}

async function dirSize(dir) {
  let total = 0;
  for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = path.join(dir, e.name);
    total += e.isDirectory() ? await dirSize(p) : (await fs.stat(p)).size;
  }
  return total;
}

async function createBackup(label = 'auto') {
  const name = `${stamp()}_${label}`;
  const dir = path.join(config.dirs.backups, name);
  await fs.mkdir(path.join(dir, 'db'), { recursive: true });
  const counts = {};
  for (const c of COLLECTIONS) {
    const docs = await mongoose.connection.db.collection(c).find().toArray();
    counts[c] = docs.length;
    await fs.writeFile(path.join(dir, 'db', `${c}.json.gz`), await gzip(EJSON.stringify(docs, { relaxed: false })));
  }
  await fs.cp(config.dirs.uploads, path.join(dir, 'uploads'), { recursive: true }).catch((e) => {
    if (e.code !== 'ENOENT') throw e;
  });
  await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify({ name, createdAt: new Date(), counts }, null, 2));
  await prune();
  return { name, counts };
}

async function listBackups() {
  const names = (await fs.readdir(config.dirs.backups).catch(() => [])).filter((n) => NAME_RE.test(n)).sort().reverse();
  const out = [];
  for (const n of names) {
    const meta = JSON.parse(await fs.readFile(path.join(config.dirs.backups, n, 'meta.json'), 'utf8').catch(() => '{}'));
    out.push({ name: n, createdAt: meta.createdAt || null, counts: meta.counts || {}, bytes: await dirSize(path.join(config.dirs.backups, n)) });
  }
  return out;
}

async function prune() {
  const names = (await fs.readdir(config.dirs.backups).catch(() => [])).filter((n) => NAME_RE.test(n) && n.endsWith('_auto')).sort().reverse();
  for (const n of names.slice(config.backupKeep)) await fs.rm(path.join(config.dirs.backups, n), { recursive: true, force: true });
}

async function restoreBackup(name) {
  if (!NAME_RE.test(name)) throw new Error('बैकअप का नाम सही नहीं');
  const dir = path.join(config.dirs.backups, name);
  await fs.access(path.join(dir, 'meta.json'));
  // read everything first so a broken file aborts before anything is changed
  const data = {};
  for (const c of COLLECTIONS) {
    const f = path.join(dir, 'db', `${c}.json.gz`);
    data[c] = EJSON.parse((await gunzip(await fs.readFile(f))).toString('utf8'), { relaxed: false });
  }
  const safety = await createBackup('before-restore');
  for (const c of COLLECTIONS) {
    const coll = mongoose.connection.db.collection(c);
    await coll.deleteMany({});
    if (data[c].length) await coll.insertMany(data[c], { ordered: false });
  }
  await fs.rm(config.dirs.uploads, { recursive: true, force: true });
  await fs.cp(path.join(dir, 'uploads'), config.dirs.uploads, { recursive: true }).catch((e) => {
    if (e.code !== 'ENOENT') throw e;
  });
  return { restored: name, safetyBackup: safety.name, counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])) };
}

module.exports = { createBackup, listBackups, restoreBackup, COLLECTIONS };
