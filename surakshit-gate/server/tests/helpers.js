const os = require('os');
const path = require('path');
const fs = require('fs');
process.env.NODE_ENV = 'test';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-test-'));
process.env.MESSAGE_PROVIDER = 'demo';
process.env.DEMO_DELIVER_MS = '30';
process.env.SCHEDULER = 'off';
process.env.PUBLIC_URL = 'https://gate.example.test';
process.env.COOKIE_SECURE = 'false'; // supertest talks plain http

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../src/app');
const User = require('../src/models/User');

const ctx = { mongod: null, app: null };
const MODELS = ['User', 'Session', 'Student', 'Attendance', 'Pickup', 'Message', 'Alert', 'Parade', 'Setting', 'Audit'];

async function start() {
  ctx.mongod = await MongoMemoryServer.create();
  await mongoose.connect(ctx.mongod.getUri());
  ctx.app = createApp();
}
async function stop() {
  await mongoose.disconnect();
  await ctx.mongod.stop();
}
async function reset() {
  await mongoose.connection.db.dropDatabase();
  await Promise.all(MODELS.map((m) => require(`../src/models/${m}`).syncIndexes()));
  fs.rmSync(path.join(process.env.DATA_DIR, 'uploads'), { recursive: true, force: true });
  fs.rmSync(path.join(process.env.DATA_DIR, 'backups'), { recursive: true, force: true });
  const hash = await bcrypt.hash('pass12345', 4);
  await User.create([
    { name: 'Admin', username: 'admin', role: 'admin', passwordHash: hash },
    { name: 'Principal', username: 'principal', role: 'principal', passwordHash: hash },
    { name: 'Teacher 5A', username: 't5a', role: 'teacher', classes: ['5A'], passwordHash: hash },
    { name: 'Guard', username: 'guard', role: 'guard', passwordHash: hash },
  ]);
}

// logged-in agent that always sends the app header
async function as(username) {
  const agent = request.agent(ctx.app);
  const wrap = {};
  for (const m of ['get', 'post', 'put', 'patch', 'delete']) wrap[m] = (url) => agent[m](url).set('x-sg-app', '1');
  if (username) await wrap.post('/api/auth/login').send({ username, password: 'pass12345' }).expect(200);
  return wrap;
}

const JPEG = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]).toString('base64');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { ctx, start, stop, reset, as, JPEG, sleep, request };
