const express = require('express');
const { rateLimit } = require('express-rate-limit');
const Pickup = require('../models/Pickup');
const Student = require('../models/Student');
const Alert = require('../models/Alert');
const Setting = require('../models/Setting');
const HttpError = require('../utils/httpError');
const { sha256 } = require('../utils/crypto');
const { sendImage } = require('../services/photos');
const { open } = require('../services/otpVault');
const { updateStatus } = require('../services/notify');
const svc = require('../services/pickups');

// Parent's secure link: /p/:token  (no login, no app). Different for every pickup, expires in minutes.
const router = express.Router();
router.use(rateLimit({ windowMs: 60000, limit: process.env.NODE_ENV === 'test' ? 1000 : 60, standardHeaders: 'draft-8', legacyHeaders: false }));

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

async function byToken(token) {
  if (!TOKEN_RE.test(token)) throw new HttpError(404, 'यह लिंक सही नहीं है', { reason: 'BAD_LINK' });
  const p = await Pickup.findOne({ parentTokenHash: sha256(token) });
  if (!p) throw new HttpError(404, 'यह लिंक सही नहीं है या पुराना हो चुका है', { reason: 'BAD_LINK' });
  await svc.refresh(p);
  return p;
}

router.get('/pickup/:token', async (req, res) => {
  const token = req.params.token;
  const p = await byToken(token);
  const s = await Setting.get();
  const student = await Student.findById(p.student).select('photo');
  const live = svc.OPEN.includes(p.status);
  if (live && !p.linkOpenedAt) {
    p.linkOpenedAt = new Date();
    await p.save();
    // the parent opened the link -> message has certainly been read
    if (p.message) await updateStatus(p.message, 'read').catch(() => {});
  }
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    school: s.schoolName,
    officePhone: s.officePhone,
    studentName: p.studentName,
    className: p.className,
    pickerName: p.pickerName,
    relation: p.relation,
    requestedAt: p.otpSentAt,
    status: p.status,
    decision: p.decision,
    expiresAt: p.otpExpiresAt,
    secondsLeft: live ? Math.max(0, Math.round((p.otpExpiresAt - Date.now()) / 1000)) : 0,
    otp: live ? open(p.otpSealed, token) : null,
    pickerPhotoUrl: p.photo && !p.photoDeletedAt ? `/api/public/pickup/${token}/photo/picker` : null,
    studentPhotoUrl: student?.photo ? `/api/public/pickup/${token}/photo/student` : null,
  });
});

router.get('/pickup/:token/photo/:which', async (req, res) => {
  const p = await byToken(req.params.token);
  if (!svc.OPEN.includes(p.status) && p.status !== 'completed') throw new HttpError(410, 'लिंक खत्म हो चुका है');
  if (req.params.which === 'picker') {
    if (!p.photo || p.photoDeletedAt) throw new HttpError(404, 'फोटो नहीं है');
    return sendImage(res, 'pickups', p.photo);
  }
  if (req.params.which === 'student') {
    const st = await Student.findById(p.student).select('photo');
    if (!st?.photo) throw new HttpError(404, 'फोटो नहीं है');
    return sendImage(res, 'students', st.photo);
  }
  throw new HttpError(404, 'नहीं मिला');
});

// POST /api/public/pickup/:token/decision { decision: 'yes' | 'no' }
router.post('/pickup/:token/decision', async (req, res) => {
  const p = await byToken(req.params.token);
  const decision = req.body?.decision;
  if (!['yes', 'no'].includes(decision)) throw new HttpError(400, 'हाँ या नहीं चुनें');
  if (p.status === 'expired') throw new HttpError(410, 'समय खत्म हो गया। स्कूल से नया लिंक माँगें।', { reason: 'EXPIRED' });
  if (p.status !== 'awaiting_parent') throw new HttpError(409, p.decision ? 'आपका जवाब पहले ही दर्ज हो चुका है' : 'यह पिकअप अब खुला नहीं है', { reason: 'DECIDED' });
  // atomic: the first answer wins
  const updated = await Pickup.findOneAndUpdate(
    { _id: p._id, status: 'awaiting_parent' },
    { decision, decisionAt: new Date(), decisionBy: 'parent', status: decision === 'yes' ? 'approved' : 'denied', linkOpenedAt: p.linkOpenedAt || new Date() },
    { returnDocument: 'after' }
  );
  if (!updated) throw new HttpError(409, 'आपका जवाब पहले ही दर्ज हो चुका है', { reason: 'DECIDED' });
  if (decision === 'no') {
    await Alert.create({ type: 'parent_denied', student: p.student, pickup: p._id, className: p.className, text: `${p.studentName} (${p.className}): माँ-बाप ने ${p.pickerName} को बच्चा देने से मना किया।` });
  }
  res.json({ ok: true, status: updated.status, decision });
});

module.exports = router;
