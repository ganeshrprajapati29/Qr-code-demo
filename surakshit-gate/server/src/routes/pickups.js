const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const config = require('../config');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Pickup = require('../models/Pickup');
const Alert = require('../models/Alert');
const Setting = require('../models/Setting');
const HttpError = require('../utils/httpError');
const { requireRole } = require('../middleware/auth');
const { str } = require('../utils/validate');
const { dayKey, clock, isDayKey } = require('../utils/time');
const { randomToken, sha256, randomDigits } = require('../utils/crypto');
const { saveImage, sendImage } = require('../services/photos');
const { notify } = require('../services/notify');
const { seal } = require('../services/otpVault');
const svc = require('../services/pickups');

const router = express.Router();
const gateStaff = requireRole('guard', 'admin', 'principal');
const office = requireRole('admin', 'principal');

async function load(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'पिकअप नहीं मिला');
  const p = await Pickup.findById(id);
  if (!p) throw new HttpError(404, 'पिकअप नहीं मिला');
  return p;
}

async function respond(req, res, p, status = 200) {
  const forOffice = ['admin', 'principal'].includes(req.user.role);
  const guardianPhone = forOffice ? (await Student.findById(p.student).select('guardianPhone'))?.guardianPhone : undefined;
  res.status(status).json({ pickup: await svc.shape(p, { forOffice, guardianPhone }) });
}

// new OTP + new parent link; previous ones stop working immediately
async function issueOtp(p, student, settings) {
  const otp = randomDigits(svc.OTP_LEN);
  const token = randomToken(24);
  p.otpHash = await bcrypt.hash(otp, 8);
  p.otpSealed = seal(otp, token);
  p.parentTokenHash = sha256(token);
  p.otpSentAt = new Date();
  p.otpExpiresAt = new Date(Date.now() + settings.otpTtlMin * 60000);
  p.otpUsedAt = null;
  p.linkOpenedAt = null;
  p.noResponseAlertedAt = null;
  p.decision = null;
  p.decisionAt = null;
  p.decisionBy = null;
  p.wrongAttempts = 0;
  p.status = 'awaiting_parent';
  await p.validate();
  const msg = await notify({
    student,
    kind: 'pickup_request',
    pickup: p._id,
    data: { name: student.name, picker: p.pickerName, relation: p.relation, link: `${config.publicUrl}/p/${token}`, otp, ttl: settings.otpTtlMin },
  });
  p.message = msg._id;
  await p.save();
}

// POST /api/pickups { studentId, pickerName, relation, photo }  -> "कोई और लेने आया है"
router.post('/', gateStaff, async (req, res) => {
  const b = req.body || {};
  if (!mongoose.isValidObjectId(b.studentId)) throw new HttpError(400, 'बच्चा नहीं मिला');
  const student = await Student.findById(b.studentId);
  if (!student || !student.active) throw new HttpError(404, 'बच्चा नहीं मिला');
  const pickerName = str(b.pickerName, 'लेने वाले का नाम', { min: 2, max: 60 });
  const relation = str(b.relation, 'रिश्ता', { max: 40, optional: true });
  if (!b.photo) throw new HttpError(400, 'लेने वाले की फोटो लें');

  const today = dayKey();
  const att = await Attendance.findOne({ student: student._id, date: today });
  if (!att) throw new HttpError(409, 'आज इस बच्चे का आना दर्ज नहीं है — पहले कार्ड स्कैन करें', { reason: 'NOT_IN' });
  if (att.outAt) throw new HttpError(409, 'बच्चा पहले ही निकल चुका है', { reason: 'ALREADY_LEFT' });

  const existing = await Pickup.findOne({ student: student._id, date: today, status: { $in: svc.OPEN } });
  if (existing) {
    await svc.refresh(existing);
    if (svc.OPEN.includes(existing.status)) throw new HttpError(409, 'इस बच्चे का एक पिकअप पहले से चल रहा है', { reason: 'PICKUP_OPEN', pickupId: String(existing._id) });
  }

  const settings = await Setting.get();
  const p = new Pickup({
    student: student._id,
    studentName: student.name,
    className: student.className,
    date: today,
    pickerName,
    relation,
    photo: await saveImage('pickups', b.photo),
    guard: req.user._id,
    guardName: req.user.name,
    otpHash: 'x', otpSealed: 'x', parentTokenHash: randomToken(), otpExpiresAt: new Date(), otpSentAt: new Date(),
  });
  await issueOtp(p, student, settings);
  await respond(req, res, p, 201);
});

// GET /api/pickups/:id  (guard screen polls this every 2 s)
router.get('/:id', gateStaff, async (req, res) => {
  await respond(req, res, await load(req.params.id));
});

router.get('/:id/photo', gateStaff, async (req, res) => {
  const p = await load(req.params.id);
  if (!p.photo || p.photoDeletedAt) throw new HttpError(404, 'फोटो मिटाई जा चुकी है');
  await sendImage(res, 'pickups', p.photo);
});

// POST /api/pickups/:id/verify { otp }  -> hand over only if parent said YES and OTP is right
router.post('/:id/verify', gateStaff, async (req, res) => {
  const p = await load(req.params.id);
  await svc.refresh(p);
  const otp = req.body?.otp;
  if (typeof otp !== 'string' || !/^\d{4,8}$/.test(otp)) throw new HttpError(400, 'OTP के अंक डालें');

  if (p.status === 'completed' || p.otpUsedAt) throw new HttpError(409, 'यह OTP पहले ही इस्तेमाल हो चुका है', { reason: 'OTP_USED' });
  if (p.status === 'expired') throw new HttpError(410, 'OTP का समय खत्म हो गया। “नया OTP भेजें” दबाएँ।', { reason: 'OTP_EXPIRED' });
  if (p.status === 'denied') throw new HttpError(403, 'माँ-बाप ने मना किया है। बच्चे को न सौंपें।', { reason: 'DENIED' });
  if (p.status === 'locked') throw new HttpError(423, 'बहुत बार गलत OTP डाला गया। पिकअप बंद। ऑफिस को बताएँ।', { reason: 'LOCKED' });
  if (p.status === 'cancelled') throw new HttpError(409, 'यह पिकअप रद्द हो चुका है', { reason: 'CANCELLED' });

  const correct = await bcrypt.compare(otp, p.otpHash);
  if (!correct) {
    p.wrongAttempts += 1;
    const student = await Student.findById(p.student);
    const lock = p.wrongAttempts >= svc.MAX_WRONG;
    if (lock) p.status = 'locked';
    await p.save();
    await Alert.create({
      type: lock ? 'pickup_locked' : 'wrong_otp',
      student: p.student,
      pickup: p._id,
      className: p.className,
      text: `${p.studentName} (${p.className}) के पिकअप पर गलत OTP डाला गया (${p.wrongAttempts} बार)। लेने वाला: ${p.pickerName}${lock ? '। पिकअप बंद कर दिया गया।' : ''}`,
    });
    if (student) {
      await notify({ student, kind: 'alert', pickup: p._id, data: { text: `${student.name} के पिकअप पर गलत OTP डाला गया (${p.wrongAttempts} बार), लेने वाला: ${p.pickerName}।` } });
    }
    throw new HttpError(lock ? 423 : 400, lock ? 'बहुत बार गलत OTP। पिकअप बंद — बच्चे को न सौंपें, ऑफिस को बताएँ।' : `OTP गलत है। बच्चे को न सौंपें। (${p.wrongAttempts}/${svc.MAX_WRONG})`, {
      reason: lock ? 'LOCKED' : 'WRONG_OTP',
      wrongAttempts: p.wrongAttempts,
    });
  }
  if (p.status !== 'approved') {
    throw new HttpError(403, 'OTP सही है, पर माँ-बाप ने अभी “हाँ” नहीं कहा। बच्चे को न सौंपें।', { reason: 'NOT_APPROVED' });
  }

  // single use: only one request can flip approved -> completed
  const now = new Date();
  const done = await Pickup.findOneAndUpdate(
    { _id: p._id, status: 'approved', otpUsedAt: null, otpExpiresAt: { $gt: now } },
    { status: 'completed', otpUsedAt: now, completedAt: now },
    { returnDocument: 'after' }
  );
  if (!done) throw new HttpError(409, 'यह OTP अब मान्य नहीं है', { reason: 'OTP_USED' });
  await Attendance.updateOne({ student: p.student, date: p.date, outAt: null }, { outAt: now, outBy: req.user._id, outMode: 'pickup', pickup: p._id });
  const student = await Student.findById(p.student);
  if (student) await notify({ student, kind: 'pickup_done', pickup: p._id, data: { name: student.name, picker: p.pickerName, time: clock(now) } });
  await respond(req, res, done);
});

// POST /api/pickups/:id/resend -> new OTP & link (old ones stop working)
router.post('/:id/resend', gateStaff, async (req, res) => {
  const p = await load(req.params.id);
  await svc.refresh(p);
  if (['completed', 'denied', 'cancelled'].includes(p.status)) throw new HttpError(409, 'इस पिकअप पर नया OTP नहीं भेजा जा सकता');
  const student = await Student.findById(p.student);
  p.round += 1;
  await issueOtp(p, student, await Setting.get());
  await respond(req, res, p);
});

router.post('/:id/cancel', gateStaff, async (req, res) => {
  const p = await load(req.params.id);
  if (!svc.OPEN.includes(p.status) && !['expired', 'locked'].includes(p.status)) throw new HttpError(409, 'यह पिकअप रद्द नहीं हो सकता');
  p.status = 'cancelled';
  await p.save();
  await respond(req, res, p);
});

// office backup: school office phoned the parent and records the answer
router.post('/:id/office-decision', office, async (req, res) => {
  const p = await load(req.params.id);
  await svc.refresh(p);
  const decision = req.body?.decision;
  if (!['yes', 'no'].includes(decision)) throw new HttpError(400, 'हाँ या नहीं चुनें');
  if (p.status !== 'awaiting_parent') throw new HttpError(409, 'इस पिकअप पर अब फैसला नहीं हो सकता');
  p.decision = decision;
  p.decisionAt = new Date();
  p.decisionBy = 'office';
  p.officeUser = req.user.name;
  p.officeNote = str(req.body?.note, 'नोट', { max: 140, optional: true });
  p.status = decision === 'yes' ? 'approved' : 'denied';
  await p.save();
  if (decision === 'no') {
    await Alert.create({ type: 'parent_denied', student: p.student, pickup: p._id, className: p.className, text: `${p.studentName} (${p.className}): माँ-बाप ने फोन पर मना किया (ऑफिस: ${req.user.name})। बच्चा न सौंपें।` });
  }
  await respond(req, res, p);
});

// GET /api/pickups?from=&to=&status=   -> pickup records (principal/admin)
router.get('/', office, async (req, res) => {
  const q = {};
  const from = isDayKey(req.query.from) ? req.query.from : null;
  const to = isDayKey(req.query.to) ? req.query.to : null;
  if (from || to) q.date = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
  if (typeof req.query.status === 'string' && Pickup.STATUSES.includes(req.query.status)) q.status = req.query.status;
  const list = await Pickup.find(q).sort({ createdAt: -1 }).limit(300);
  const settings = await Setting.get();
  res.json({ pickups: await Promise.all(list.map((p) => svc.shape(p, { settings }))) });
});

module.exports = router;
