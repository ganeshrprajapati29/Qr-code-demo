const express = require('express');
const Setting = require('../models/Setting');
const Student = require('../models/Student');
const Message = require('../models/Message');
const Audit = require('../models/Audit');
const HttpError = require('../utils/httpError');
const config = require('../config');
const { requireRole } = require('../middleware/auth');
const { str, className, int } = require('../utils/validate');
const { normalizePhone, isValidPhone } = require('../utils/phone');
const { audit } = require('../services/audit');
const backup = require('../services/backup');
const { reissueCard } = require('../services/cards');
const { updateStatus } = require('../services/notify');

const router = express.Router();
const admin = requireRole('admin');

const shapeSettings = (s) => ({
  schoolName: s.schoolName,
  officePhone: s.officePhone,
  otpTtlMin: s.otpTtlMin,
  parentTimeoutMin: s.parentTimeoutMin,
  pickupPhotoRetentionDays: s.pickupPhotoRetentionDays,
  backupHour: s.backupHour,
  sessionName: s.sessionName,
  dismissalTime: s.dismissalTime,
  repeatGraceMin: s.repeatGraceMin,
  lastBackupAt: s.lastBackupAt,
  messageProvider: config.messages.provider,
});

router.get('/settings', requireRole('admin', 'principal'), async (req, res) => {
  res.json({ settings: shapeSettings(await Setting.get()) });
});

router.put('/settings', admin, async (req, res) => {
  const s = await Setting.get();
  const b = req.body || {};
  if (b.schoolName !== undefined) s.schoolName = str(b.schoolName, 'स्कूल का नाम', { min: 2, max: 80 });
  if (b.officePhone !== undefined) {
    const p = normalizePhone(b.officePhone);
    if (b.officePhone && !/^\d{10,12}$/.test(p)) throw new HttpError(400, 'ऑफिस का फोन नंबर सही नहीं');
    s.officePhone = b.officePhone ? p : '';
  }
  if (b.otpTtlMin !== undefined) s.otpTtlMin = int(b.otpTtlMin, 'OTP समय', { min: 5, max: 10 });
  if (b.parentTimeoutMin !== undefined) s.parentTimeoutMin = int(b.parentTimeoutMin, 'जवाब का समय', { min: 2, max: 10 });
  if (b.pickupPhotoRetentionDays !== undefined) s.pickupPhotoRetentionDays = int(b.pickupPhotoRetentionDays, 'फोटो रखने के दिन', { min: 1, max: 365 });
  if (b.backupHour !== undefined) s.backupHour = int(b.backupHour, 'बैकअप का समय', { min: 0, max: 23 });
  if (b.dismissalTime !== undefined) {
    if (typeof b.dismissalTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.dismissalTime)) throw new HttpError(400, 'छुट्टी का समय HH:MM में लिखें (जैसे 12:30)');
    s.dismissalTime = b.dismissalTime;
  }
  if (b.repeatGraceMin !== undefined) s.repeatGraceMin = int(b.repeatGraceMin, 'दोबारा स्कैन की छूट', { min: 0, max: 30 });
  if (s.parentTimeoutMin > s.otpTtlMin) throw new HttpError(400, 'जवाब का समय OTP के समय से ज़्यादा नहीं हो सकता');
  await s.save();
  await audit(req, 'settings.edit', Object.keys(b).join(', '));
  res.json({ settings: shapeSettings(s) });
});

// POST /api/admin/new-session { sessionName, moves: [{from,to}], removeClasses: [] }
router.post('/new-session', admin, async (req, res) => {
  const b = req.body || {};
  const sessionName = str(b.sessionName, 'सत्र का नाम', { min: 4, max: 20 });
  const moves = Array.isArray(b.moves) ? b.moves.map((m) => ({ from: className(m?.from), to: className(m?.to) })) : [];
  const remove = Array.isArray(b.removeClasses) ? [...new Set(b.removeClasses.map(className))] : [];
  if (moves.some((m) => remove.includes(m.from))) throw new HttpError(400, 'एक ही क्लास को बदलना और हटाना दोनों नहीं हो सकता');
  if (new Set(moves.map((m) => m.from)).size !== moves.length) throw new HttpError(400, 'एक क्लास एक बार ही बदलें');
  const pre = await backup.createBackup('before-session');

  let removed = 0;
  for (const cls of remove) {
    const list = await Student.find({ className: cls, active: true });
    for (const s of list) {
      s.active = false;
      s.removedAt = new Date();
      await reissueCard(s);
      removed++;
    }
  }
  // move in two steps so 5A->6A and 6A->7A do not collide
  const tag = `__${Date.now()}_`;
  let moved = 0;
  for (const m of moves) moved += (await Student.updateMany({ className: m.from, active: true }, { className: tag + m.to })).modifiedCount;
  for (const m of moves) await Student.updateMany({ className: tag + m.to }, { className: m.to });

  const s = await Setting.get();
  s.sessionName = sessionName;
  await s.save();
  await audit(req, 'session.new', `${sessionName}: ${moved} बच्चे आगे बढ़े, ${removed} हटे`);
  res.json({ sessionName, moved, removed, backup: pre.name });
});

router.get('/backups', admin, async (req, res) => {
  res.json({ backups: await backup.listBackups() });
});

router.post('/backups', admin, async (req, res) => {
  const r = await backup.createBackup('manual');
  await audit(req, 'backup.create', r.name);
  res.status(201).json(r);
});

router.post('/backups/restore', admin, async (req, res) => {
  const { name, confirm } = req.body || {};
  if (confirm !== 'RESTORE') throw new HttpError(400, 'पुष्टि के लिए RESTORE लिखें');
  if (typeof name !== 'string') throw new HttpError(400, 'बैकअप चुनें');
  let r;
  try {
    r = await backup.restoreBackup(name);
  } catch (e) {
    throw new HttpError(400, 'बैकअप वापस नहीं आ सका: ' + e.message);
  }
  await audit(req, 'backup.restore', name);
  res.json(r);
});

router.get('/audit', admin, async (req, res) => {
  const rows = await Audit.find().sort({ at: -1 }).limit(200).lean();
  res.json({ audit: rows.map((a) => ({ at: a.at, user: a.userName, action: a.action, detail: a.detail })) });
});

// message log
router.get('/messages', requireRole('admin', 'principal'), async (req, res) => {
  const q = {};
  if (typeof req.query.phone === 'string' && /^\d{10}$/.test(req.query.phone)) q.to = req.query.phone;
  if (req.query.failed === '1') q.status = 'failed';
  const rows = await Message.find(q).sort({ createdAt: -1 }).limit(Math.min(Number(req.query.limit) || 100, 300)).populate('student', 'name className');
  res.json({
    provider: config.messages.provider,
    messages: rows.map((m) => ({
      id: String(m._id), to: m.to, kind: m.kind, text: m.text, status: m.status, error: m.error,
      student: m.student ? { id: String(m.student._id), name: m.student.name, className: m.student.className } : null,
      createdAt: m.createdAt, sentAt: m.sentAt, deliveredAt: m.deliveredAt, readAt: m.readAt,
    })),
  });
});

// demo provider only: "parent's phone" opened the message
router.post('/messages/:id/demo-read', requireRole('admin', 'principal'), async (req, res) => {
  if (config.messages.provider !== 'demo') throw new HttpError(400, 'सिर्फ डेमो मोड में');
  await updateStatus(String(req.params.id).match(/^[a-f0-9]{24}$/) ? req.params.id : null, 'read');
  res.json({ ok: true });
});

module.exports = router;
