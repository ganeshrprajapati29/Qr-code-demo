const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { ctx, start, stop, reset, as, JPEG, sleep, request } = require('./helpers');
const { notify } = require('../src/services/notify');
const Message = require('../src/models/Message');
const Student = require('../src/models/Student');
const Pickup = require('../src/models/Pickup');
const Alert = require('../src/models/Alert');

before(start);
after(stop);
beforeEach(reset);

async function addStudent(admin, over = {}) {
  const r = await admin.post('/api/students').send({ name: 'आरव शर्मा', className: '5a', guardianPhone: '98765 43210', photo: JPEG, ...over }).expect(201);
  return r.body.student;
}

test('security: login, lockout, roles, CSRF header', async () => {
  await request(ctx.app).get('/api/reports/today').expect(401);
  const anon = await as();
  await anon.post('/api/auth/login').send({ username: 'guard', password: 'wrong' }).expect(401);
  // CSRF: state-changing call without the app header is refused
  await request(ctx.app).post('/api/auth/login').send({ username: 'guard', password: 'pass12345' }).expect(403);

  const guard = await as('guard');
  await guard.get('/api/reports/today').expect(403); // guard: no reports
  await guard.get('/api/students').expect(403);
  const teacher = await as('t5a');
  await teacher.put('/api/reports/parade').send({ className: '6B', count: 3 }).expect(403); // other class
  await teacher.get('/api/users').expect(403);

  // 5 wrong passwords -> locked even with the right password
  for (let i = 0; i < 5; i++) await anon.post('/api/auth/login').send({ username: 't5a', password: 'nope' }).expect(401);
  const r = await anon.post('/api/auth/login').send({ username: 't5a', password: 'pass12345' }).expect(429);
  assert.equal(r.body.reason, 'LOCKED');

  // passwords are stored hashed
  const u = await mongoose.connection.db.collection('users').findOne({ username: 'guard' });
  assert.ok(u.passwordHash.startsWith('$2') && !JSON.stringify(u).includes('pass12345'));
  // NoSQL operator injection rejected
  await anon.post('/api/auth/login').send({ username: { $ne: '' }, password: { $ne: '' } }).expect(400);
});

test('3.1 / 3.2 students, CSV import, unguessable QR, lost card', async () => {
  const admin = await as('admin');
  const s = await addStudent(admin);
  assert.equal(s.className, '5A');
  assert.equal(s.guardianPhone, '9876543210');
  assert.ok(s.qr.startsWith('SG1.') && s.qr.length > 20);
  assert.ok(!s.qr.includes('आरव') && !s.qr.includes('9876543210') && !s.qr.includes(s.id), 'QR reveals nothing');

  const csv = '﻿name,class,mobile,roll\n"सिया वर्मा",5A,9876500001,2\nकबीर सिंह,6b,+91 98765 00002,1\nX,5A,123,3\n';
  const dry = await admin.post('/api/students/import').send({ csv }).expect(200);
  assert.equal(dry.body.valid, 2);
  assert.equal(dry.body.errors.length, 1);
  assert.equal(dry.body.errors[0].line, 4);
  const imp = await admin.post('/api/students/import').send({ csv: csv.replace('X,5A,123,3\n', '') }).expect(201);
  assert.equal(imp.body.imported, 2);
  const list = await admin.get('/api/students?class=5A').expect(200);
  assert.equal(list.body.students.length, 2);

  // lost card: old QR blocked, new QR works
  const guard = await as('guard');
  const reissued = (await admin.post(`/api/students/${s.id}/new-card`).expect(200)).body.student;
  assert.notEqual(reissued.qr, s.qr);
  const old = await guard.post('/api/gate/scan').send({ code: s.qr }).expect(410);
  assert.equal(old.body.reason, 'CARD_REVOKED');
  assert.equal(await Alert.countDocuments({ type: 'revoked_card' }), 1);
  await guard.post('/api/gate/scan').send({ code: reissued.qr }).expect(200);

  // removed student: card stops working, history kept
  await admin.delete(`/api/students/${s.id}`).expect(200);
  await guard.post('/api/gate/scan').send({ code: reissued.qr }).expect(410);
  await guard.post('/api/gate/scan').send({ code: 'random text' }).expect(400);
  await guard.post('/api/gate/scan').send({ code: 'SG1.AAAAAAAAAAAAAAAAAAAAAAAA' }).expect(404);
});

test('3.3 / 3.4 gate: arrival + exit messages with status ticks', async () => {
  const admin = await as('admin');
  const guard = await as('guard');
  const s = await addStudent(admin);
  const t0 = Date.now();
  const scan = await guard.post('/api/gate/scan').send({ code: s.qr }).expect(200);
  assert.ok(Date.now() - t0 < 2000, 'scan answers within 2 seconds');
  assert.equal(scan.body.event, 'arrived');
  assert.equal(scan.body.student.name, 'आरव शर्मा');
  assert.ok(scan.body.student.photoUrl);
  await notify.flush();
  await sleep(80);
  const again = await guard.post('/api/gate/scan').send({ code: s.qr }).expect(200);
  assert.equal(again.body.event, 'inside');
  assert.equal(again.body.arrivalMessage.status, 'delivered');
  assert.equal(await Message.countDocuments({ kind: 'arrival' }), 1, 'second scan does not send again');

  // guard can load the photo, parent text has time
  await guard.get(scan.body.student.photoUrl).expect(200).expect('content-type', /image\/jpeg/);
  const m = await Message.findOne({ kind: 'arrival' });
  assert.match(m.text, /आरव शर्मा \(क्लास 5A\) .* पर स्कूल पहुँच गए हैं/);

  const ex = await guard.post('/api/gate/exit').send({ studentId: s.id }).expect(200);
  assert.equal(ex.body.event, 'left');
  assert.equal(ex.body.attendance.outMode, 'parent');
  await guard.post('/api/gate/exit').send({ studentId: s.id }).expect(409);
  await notify.flush();
  assert.equal(await Message.countDocuments({ kind: 'exit' }), 1);
});

test('3.4 wrong / switched-off number is reported to guard and admin', async () => {
  const admin = await as('admin');
  const guard = await as('guard');
  const s = await addStudent(admin, { guardianPhone: '9000000000' }); // demo: ends in 0000 = fails
  await guard.post('/api/gate/scan').send({ code: s.qr }).expect(200);
  await notify.flush();
  const again = await guard.post('/api/gate/scan').send({ code: s.qr }).expect(200);
  assert.equal(again.body.student.phoneStatus, 'failed');
  assert.equal(again.body.arrivalMessage.status, 'failed');
  const alerts = await admin.get('/api/alerts').expect(200);
  assert.ok(alerts.body.alerts.some((a) => a.type === 'message_failed' && a.text.includes('9000000000')));
});

// helpers for pickup tests
async function setupPickup() {
  const admin = await as('admin');
  const guard = await as('guard');
  const s = await addStudent(admin);
  await guard.post('/api/gate/scan').send({ code: s.qr }).expect(200);
  const r = await guard.post('/api/pickups').send({ studentId: s.id, pickerName: 'राकेश', relation: 'चाचा', photo: JPEG }).expect(201);
  await notify.flush();
  const msg = await Message.findOne({ kind: 'pickup_request' }).sort({ createdAt: -1 });
  const token = msg.text.match(/\/p\/([A-Za-z0-9_-]+)/)[1];
  const otp = msg.text.match(/OTP: (\d{4})/)[1];
  return { admin, guard, s, pickup: r.body.pickup, token, otp, msg, parent: await as() };
}

test('3.5 pickup: YES + correct OTP needed; single use; record', async () => {
  const { guard, pickup, token, otp, parent, admin, s } = await setupPickup();
  assert.equal(pickup.status, 'awaiting_parent');
  assert.equal(JSON.stringify(pickup).includes(otp), false, 'guard never receives the OTP');
  assert.equal(pickup.message.status, 'sent');

  // correct OTP but parent has not said yes -> not handed over
  const early = await guard.post(`/api/pickups/${pickup.id}/verify`).send({ otp }).expect(403);
  assert.equal(early.body.reason, 'NOT_APPROVED');

  // parent opens the link: sees photo, name, OTP; guard sees "देख लिया"
  const page = await parent.get(`/api/public/pickup/${token}`).expect(200);
  assert.equal(page.body.otp, otp);
  assert.equal(page.body.pickerName, 'राकेश');
  await parent.get(page.body.pickerPhotoUrl).expect(200);
  const seen = (await guard.get(`/api/pickups/${pickup.id}`).expect(200)).body.pickup;
  assert.ok(seen.linkOpenedAt);
  assert.equal(seen.message.status, 'read');

  await parent.post(`/api/public/pickup/${token}/decision`).send({ decision: 'yes' }).expect(200);
  await parent.post(`/api/public/pickup/${token}/decision`).send({ decision: 'no' }).expect(409); // first answer wins

  // after YES: wrong OTP -> alert + counted
  const wrongOtp = otp === '0000' ? '1111' : '0000';
  const w = await guard.post(`/api/pickups/${pickup.id}/verify`).send({ otp: wrongOtp }).expect(400);
  assert.equal(w.body.reason, 'WRONG_OTP');
  assert.equal(await Alert.countDocuments({ type: 'wrong_otp' }), 1);

  const ok = await guard.post(`/api/pickups/${pickup.id}/verify`).send({ otp }).expect(200);
  assert.equal(ok.body.pickup.status, 'completed');
  // single use
  const reuse = await guard.post(`/api/pickups/${pickup.id}/verify`).send({ otp }).expect(409);
  assert.equal(reuse.body.reason, 'OTP_USED');
  // link no longer shows the OTP
  assert.equal((await parent.get(`/api/public/pickup/${token}`).expect(200)).body.otp, null);

  // 3.6 record
  const rec = (await admin.get('/api/pickups').expect(200)).body.pickups[0];
  assert.equal(rec.studentName, s.name);
  assert.equal(rec.pickerName, 'राकेश');
  assert.equal(rec.wrongAttempts, 1);
  assert.ok(rec.otpSentAt && rec.decisionAt && rec.completedAt && rec.photoUrl);
  const att = await mongoose.connection.db.collection('attendances').findOne({});
  assert.equal(att.outMode, 'pickup');
  await notify.flush();
  assert.equal(await Message.countDocuments({ kind: 'pickup_done' }), 1);
});

test('3.5 parent says NO -> red warning, no handover, record kept', async () => {
  const { guard, pickup, token, otp, parent, admin } = await setupPickup();
  await parent.post(`/api/public/pickup/${token}/decision`).send({ decision: 'no' }).expect(200);
  const g = (await guard.get(`/api/pickups/${pickup.id}`).expect(200)).body.pickup;
  assert.equal(g.status, 'denied');
  const v = await guard.post(`/api/pickups/${pickup.id}/verify`).send({ otp }).expect(403);
  assert.equal(v.body.reason, 'DENIED');
  assert.ok((await admin.get('/api/alerts')).body.alerts.some((a) => a.type === 'parent_denied'));
  assert.equal((await admin.get('/api/pickups?status=denied')).body.pickups.length, 1);
});

test('3.5 old OTP late or again does not work; resend issues a new one', async () => {
  const { guard, pickup, token, otp, parent } = await setupPickup();
  await parent.post(`/api/public/pickup/${token}/decision`).send({ decision: 'yes' }).expect(200);
  await Pickup.updateOne({ _id: pickup.id }, { otpExpiresAt: new Date(Date.now() - 1000) });
  const late = await guard.post(`/api/pickups/${pickup.id}/verify`).send({ otp }).expect(410);
  assert.equal(late.body.reason, 'OTP_EXPIRED');
  const lateYes = await parent.post(`/api/public/pickup/${token}/decision`).send({ decision: 'yes' }).expect(410);
  assert.equal(lateYes.body.reason, 'EXPIRED');

  await guard.post(`/api/pickups/${pickup.id}/resend`).expect(200);
  await notify.flush();
  const msg = await Message.findOne({ kind: 'pickup_request' }).sort({ createdAt: -1 });
  const token2 = msg.text.match(/\/p\/([A-Za-z0-9_-]+)/)[1];
  const otp2 = msg.text.match(/OTP: (\d{4})/)[1];
  assert.notEqual(token2, token);
  await parent.get(`/api/public/pickup/${token}`).expect(404); // old link dead
  await parent.post(`/api/public/pickup/${token2}/decision`).send({ decision: 'yes' }).expect(200);
  if (otp2 !== otp) await guard.post(`/api/pickups/${pickup.id}/verify`).send({ otp }).expect(400); // old OTP rejected
  await guard.post(`/api/pickups/${pickup.id}/verify`).send({ otp: otp2 }).expect(200);
});

test('3.5 no reply in time -> office backup; 5 wrong OTPs lock the pickup', async () => {
  const { guard, pickup, admin } = await setupPickup();
  await Pickup.updateOne({ _id: pickup.id }, { otpSentAt: new Date(Date.now() - 6 * 60000) });
  const g = (await guard.get(`/api/pickups/${pickup.id}`).expect(200)).body.pickup;
  assert.equal(g.noResponse, true);
  assert.equal(g.officePhone, '');
  assert.equal(g.guardianPhone, undefined, 'guard does not get the parent number');
  assert.equal(await Alert.countDocuments({ type: 'parent_no_response' }), 1);
  await guard.post(`/api/pickups/${pickup.id}/office-decision`).send({ decision: 'yes' }).expect(403); // guard cannot
  const off = await admin.post(`/api/pickups/${pickup.id}/office-decision`).send({ decision: 'yes', note: 'माँ से फोन पर बात हुई' }).expect(200);
  assert.equal(off.body.pickup.status, 'approved');
  assert.equal(off.body.pickup.decisionBy, 'office');
  assert.equal(off.body.pickup.guardianPhone, '9876543210');

  const { otp } = { otp: (await Message.findOne({ kind: 'pickup_request' })).text.match(/OTP: (\d{4})/)[1] };
  const wrong = otp === '0000' ? '1111' : '0000';
  for (let i = 1; i <= 4; i++) {
    const r = await guard.post(`/api/pickups/${pickup.id}/verify`).send({ otp: wrong }).expect(400);
    assert.equal(r.body.wrongAttempts, i);
  }
  const lock = await guard.post(`/api/pickups/${pickup.id}/verify`).send({ otp: wrong }).expect(423);
  assert.equal(lock.body.reason, 'LOCKED');
  // even the right OTP does not work any more
  await guard.post(`/api/pickups/${pickup.id}/verify`).send({ otp }).expect(423);
  assert.ok(await Alert.exists({ type: 'pickup_locked' }));
});

test('3.7 principal page: counts, class-wise, absent list, parade green/red, monthly', async () => {
  const admin = await as('admin');
  const guard = await as('guard');
  const a = await addStudent(admin, { name: 'आरव', className: '5A', guardianPhone: '9876500011' });
  const b = await addStudent(admin, { name: 'सिया', className: '5A', guardianPhone: '9876500012' });
  await addStudent(admin, { name: 'कबीर', className: '5A', guardianPhone: '9876500013' });
  const d = await addStudent(admin, { name: 'मीरा', className: '6B', guardianPhone: '9876500014' });
  for (const s of [a, b, d]) await guard.post('/api/gate/scan').send({ code: s.qr }).expect(200);
  await guard.post('/api/gate/exit').send({ studentId: b.id }).expect(200);

  const principal = await as('principal');
  const r = (await principal.get('/api/reports/today').expect(200)).body;
  assert.deepEqual(r.totals, { total: 4, present: 3, inside: 2, left: 1, absent: 1 });
  const c5 = r.classes.find((c) => c.className === '5A');
  assert.equal(c5.present, 2);
  assert.equal(c5.absent, 1);
  assert.deepEqual(c5.absentList.map((x) => x.name), ['कबीर']);

  const teacher = await as('t5a');
  const tv = (await teacher.get('/api/reports/today').expect(200)).body;
  assert.deepEqual(tv.classes.map((c) => c.className), ['5A'], 'teacher sees only own class');
  const green = (await teacher.put('/api/reports/parade').send({ className: '5A', count: 1 }).expect(200)).body.class;
  assert.equal(green.parade.match, true);
  const red = (await teacher.put('/api/reports/parade').send({ className: '5A', count: 3 }).expect(200)).body.class;
  assert.equal(red.parade.match, false);
  assert.equal(red.parade.diff, 2);

  const m = (await principal.get('/api/reports/monthly').expect(200)).body;
  assert.equal(m.schoolDays, 1);
  assert.equal(m.students.find((x) => x.name === 'कबीर').absent, 1);
});

test('3.8 admin: logins, disable, new session; daily backup restore', async () => {
  const admin = await as('admin');
  const u = (await admin.post('/api/users').send({ name: 'नई टीचर', username: 'T6B', role: 'teacher', classes: ['6b'], password: 'secret123' }).expect(201)).body.user;
  assert.equal(u.username, 't6b');
  assert.deepEqual(u.classes, ['6B']);
  const anon = await as();
  await anon.post('/api/auth/login').send({ username: 't6b', password: 'secret123' }).expect(200);
  await admin.patch(`/api/users/${u.id}`).send({ active: false }).expect(200);
  await anon.get('/api/auth/me').expect(401); // logged out when disabled
  await (await as()).post('/api/auth/login').send({ username: 't6b', password: 'secret123' }).expect(403);

  const s5 = await addStudent(admin, { className: '5A' });
  await addStudent(admin, { name: 'बड़ा बच्चा', className: '8A', guardianPhone: '9876500099' });
  const ns = await admin.post('/api/admin/new-session').send({ sessionName: '2027-28', moves: [{ from: '5A', to: '6A' }], removeClasses: ['8A'] }).expect(200);
  assert.equal(ns.body.moved, 1);
  assert.equal(ns.body.removed, 1);
  assert.equal((await Student.findById(s5.id)).className, '6A');

  // backup -> delete -> restore -> data back
  const bk = (await admin.post('/api/admin/backups').expect(201)).body;
  await admin.delete(`/api/students/${s5.id}`).expect(200);
  assert.equal(await Student.countDocuments({ active: true }), 0);
  await admin.post('/api/admin/backups/restore').send({ name: bk.name }).expect(400); // needs confirm
  const rs = await admin.post('/api/admin/backups/restore').send({ name: bk.name, confirm: 'RESTORE' }).expect(200);
  assert.ok(rs.body.safetyBackup);
  assert.equal(await Student.countDocuments({ active: true }), 1);
  await (await as('admin')).get(`/api/students/${s5.id}/photo`).expect(200); // photos restored too
  assert.ok((await admin.get('/api/admin/backups')).body.backups.length >= 2);
});

test('5 picker photos are deleted after the retention period', async () => {
  const { pickup } = await setupPickup();
  // createdAt is immutable in mongoose, change it directly in the collection
  await Pickup.collection.updateOne({ _id: new mongoose.Types.ObjectId(pickup.id) }, { $set: { createdAt: new Date(Date.now() - 40 * 86400000) } });
  const n = await require('../src/services/scheduler').cleanupPhotos();
  assert.equal(n, 1);
  const p = await Pickup.findById(pickup.id);
  assert.ok(p.photoDeletedAt);
  assert.equal(p.photo, '');
});

test('WhatsApp webhook: signature required, statuses update, bad number alerts', async () => {
  const config = require('../src/config');
  config.whatsapp.appSecret = 'test-secret';
  const admin = await as('admin');
  const s = await addStudent(admin);
  const msg = await Message.create({ to: '9876543210', student: s.id, kind: 'arrival', text: 'x', provider: 'whatsapp', providerId: 'wamid.1', status: 'sent' });
  const payload = (status, extra = {}) => JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', status, timestamp: '1700000000', ...extra }] } }] }] });
  const sign = (body) => 'sha256=' + require('crypto').createHmac('sha256', 'test-secret').update(body).digest('hex');
  const post = (body, sig) => request(ctx.app).post('/api/webhooks/whatsapp').set('content-type', 'application/json').set('x-hub-signature-256', sig).send(body);

  await post(payload('delivered'), 'sha256=bad').expect(401);
  await post(payload('read'), sign(payload('read'))).expect(200);
  assert.equal((await Message.findById(msg._id)).status, 'read');
  await post(payload('delivered'), sign(payload('delivered'))).expect(200);
  assert.equal((await Message.findById(msg._id)).status, 'read', 'never goes backwards');

  await Message.updateOne({ _id: msg._id }, { status: 'sent' });
  const f = payload('failed', { errors: [{ code: 131026, title: 'Message undeliverable' }] });
  await post(f, sign(f)).expect(200);
  assert.equal((await Student.findById(s.id)).phoneStatus, 'failed');
  assert.ok(await Alert.exists({ type: 'message_failed' }));
  config.whatsapp.appSecret = '';
});

test('NEW: second morning scan while inside -> alert (quick double scan ignored)', async () => {
  const Setting = require('../src/models/Setting');
  const Attendance = require('../src/models/Attendance');
  const admin = await as('admin');
  const guard = await as('guard');
  const s = await addStudent(admin);
  await Setting.updateOne({ _id: 'main' }, { dismissalTime: '23:59', repeatGraceMin: 2 }, { upsert: true }); // whole day = "morning"

  await guard.post('/api/gate/scan').send({ code: s.qr }).expect(200);
  // guard scans again by mistake a few seconds later: warning only, no alert
  const quick = (await guard.post('/api/gate/scan').send({ code: s.qr }).expect(200)).body;
  assert.equal(quick.repeat.count, 2);
  assert.equal(quick.repeat.alerted, false);
  assert.equal(await Alert.countDocuments({ type: 'repeat_scan' }), 0);

  // later in the morning the same card comes again -> alert for principal
  await Attendance.updateOne({}, { lastScanAt: new Date(Date.now() - 10 * 60000) });
  const again = (await guard.post('/api/gate/scan').send({ code: s.qr }).expect(200)).body;
  assert.equal(again.event, 'inside');
  assert.equal(again.repeat.count, 3);
  assert.equal(again.repeat.alerted, true);
  const al = (await admin.get('/api/alerts').expect(200)).body.alerts.find((a) => a.type === 'repeat_scan');
  assert.match(al.text, /3 बार स्कैन/);
  assert.match(al.textEn, /scanned 3 times this morning/);
  const recent = (await guard.get('/api/gate/recent').expect(200)).body.recent[0];
  assert.equal(recent.scans, 3);
  assert.equal(recent.repeatAlerted, true);

  // after home time a repeat scan is normal (exit), no alert
  await Setting.updateOne({ _id: 'main' }, { dismissalTime: '00:00' });
  await Attendance.updateOne({}, { lastScanAt: new Date(Date.now() - 10 * 60000) });
  const home = (await guard.post('/api/gate/scan').send({ code: s.qr }).expect(200)).body;
  assert.equal(home.repeat.morning, false);
  assert.equal(home.repeat.alerted, false);
  assert.equal(await Alert.countDocuments({ type: 'repeat_scan' }), 1);

  // settings validation
  await admin.put('/api/admin/settings').send({ dismissalTime: '25:00' }).expect(400);
  const ok = await admin.put('/api/admin/settings').send({ dismissalTime: '12:30', repeatGraceMin: 3 }).expect(200);
  assert.equal(ok.body.settings.dismissalTime, '12:30');
});

test('NEW: English language for errors, alerts and parent messages', async () => {
  const admin = await as('admin');
  const guard = await as('guard');
  // errors follow the x-sg-lang header
  const en = await guard.post('/api/gate/scan').set('x-sg-lang', 'en').send({ code: 'hello' }).expect(400);
  assert.equal(en.body.error, "This is not the school's QR card");
  const hi = await guard.post('/api/gate/scan').send({ code: 'hello' }).expect(400);
  assert.equal(hi.body.error, 'यह स्कूल का QR कार्ड नहीं है');
  const v = await admin.post('/api/students').set('x-sg-lang', 'en').send({ name: '', className: '5A', guardianPhone: '9876543210' }).expect(400);
  assert.equal(v.body.error, "Please enter child's name");
  const login = await (await as()).post('/api/auth/login').set('x-sg-lang', 'en').send({ username: 'guard', password: 'x' }).expect(401);
  assert.equal(login.body.error, 'Wrong username or password');

  // parent language decides message + link page language
  const s = await addStudent(admin, { guardianLang: 'en' });
  assert.equal(s.guardianLang, 'en');
  await guard.post('/api/gate/scan').send({ code: s.qr }).expect(200);
  await notify.flush();
  const m = await Message.findOne({ kind: 'arrival' });
  assert.equal(m.lang, 'en');
  assert.match(m.text, /reached school at/);
  await guard.post('/api/gate/scan').send({ code: s.qr }).expect(200);
  await guard.post('/api/pickups').send({ studentId: s.id, pickerName: 'Rakesh', relation: 'Uncle', photo: JPEG }).expect(201);
  await notify.flush();
  const pm = await Message.findOne({ kind: 'pickup_request' });
  assert.match(pm.text, /has come to pick up your child/);
  const token = pm.text.match(/\/p\/([A-Za-z0-9_-]+)/)[1];
  const page = (await (await as()).get(`/api/public/pickup/${token}`).expect(200)).body;
  assert.equal(page.lang, 'en');

  // CSV language column
  const csv = 'name,class,mobile,language\nAsha,5A,9876511111,English\nरानी,5A,9876511112,हिंदी\n';
  await admin.post('/api/students/import').send({ csv }).expect(201);
  const list = (await admin.get('/api/students?search=98765111').expect(200)).body.students;
  assert.deepEqual(list.map((x) => x.guardianLang).sort(), ['en', 'hi']);
});
