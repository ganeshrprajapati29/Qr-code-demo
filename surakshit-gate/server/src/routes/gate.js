const express = require('express');
const mongoose = require('mongoose');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Pickup = require('../models/Pickup');
const Alert = require('../models/Alert');
const Message = require('../models/Message');
const HttpError = require('../utils/httpError');
const { requireRole } = require('../middleware/auth');
const { parseQr, findByCard } = require('../services/cards');
const { notify, shapeMessage } = require('../services/notify');
const { dayKey, clock } = require('../utils/time');
const pickups = require('../services/pickups');

const router = express.Router();
router.use(requireRole('guard', 'admin', 'principal'));

function studentCard(s) {
  return {
    id: String(s._id),
    name: s.name,
    className: s.className,
    rollNo: s.rollNo,
    photoUrl: s.photo ? `/api/students/${s._id}/photo?v=${encodeURIComponent(s.photo)}` : null,
    phoneStatus: s.phoneStatus,
    phoneStatusNote: s.phoneStatusNote,
  };
}

async function state(student, today) {
  const att = await Attendance.findOne({ student: student._id, date: today });
  const msgs = att ? await Message.find({ student: student._id, kind: { $in: ['arrival', 'exit'] }, createdAt: { $gte: new Date(att.inAt.getTime() - 60000) } }).sort({ createdAt: 1 }) : [];
  const open = await Pickup.findOne({ student: student._id, date: today, status: { $in: pickups.OPEN } }).sort({ createdAt: -1 });
  if (open) await pickups.refresh(open);
  return {
    attendance: att ? { inAt: att.inAt, outAt: att.outAt, outMode: att.outMode } : null,
    arrivalMessage: shapeMessage(msgs.find((m) => m.kind === 'arrival')),
    exitMessage: shapeMessage(msgs.find((m) => m.kind === 'exit')),
    openPickupId: open && pickups.OPEN.includes(open.status) ? String(open._id) : null,
  };
}

// POST /api/gate/scan { code }  -> first scan of the day = arrival (record + message)
router.post('/scan', async (req, res) => {
  const token = parseQr(req.body?.code);
  if (!token) throw new HttpError(400, 'यह स्कूल का QR कार्ड नहीं है', { reason: 'NOT_OUR_CARD' });
  const { student, revoked } = await findByCard(token);
  if (!student) {
    await Alert.create({ type: 'unknown_card', text: `गेट पर अनजान कार्ड स्कैन हुआ (${clock()})। नकली कार्ड हो सकता है।` });
    throw new HttpError(404, 'यह कार्ड सिस्टम में नहीं है — नकली कार्ड हो सकता है', { reason: 'UNKNOWN_CARD' });
  }
  if (revoked || !student.active) {
    await Alert.create({
      type: 'revoked_card',
      student: student._id,
      className: student.className,
      text: `${student.name} (${student.className}) का बंद/पुराना कार्ड गेट पर स्कैन हुआ (${clock()})। जाँच करें।`,
    });
    throw new HttpError(410, revoked ? 'यह कार्ड बंद कर दिया गया है (खोया/पुराना कार्ड)। बच्चे को न जाने दें, ऑफिस को बताएँ।' : 'यह बच्चा स्कूल की सूची से हटाया जा चुका है।', {
      reason: revoked ? 'CARD_REVOKED' : 'STUDENT_REMOVED',
      student: studentCard(student),
    });
  }

  const today = dayKey();
  let event = 'inside';
  let att = await Attendance.findOne({ student: student._id, date: today });
  if (!att) {
    try {
      att = await Attendance.create({ student: student._id, className: student.className, date: today, inAt: new Date(), inBy: req.user._id });
      event = 'arrived';
      await notify({ student, kind: 'arrival', data: { name: student.name, cls: student.className, time: clock(att.inAt) } });
    } catch (e) {
      if (e.code !== 11000) throw e; // two guards scanned at the same moment
      att = await Attendance.findOne({ student: student._id, date: today });
    }
  }
  if (att.outAt) event = 'left';
  res.json({ event, student: studentCard(student), ...(await state(student, today)) });
});

// GET /api/gate/students/:id  -> refresh (message ticks)
router.get('/students/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'बच्चा नहीं मिला');
  const student = await Student.findById(req.params.id);
  if (!student) throw new HttpError(404, 'बच्चा नहीं मिला');
  res.json({ student: studentCard(student), ...(await state(student, dayKey())) });
});

// POST /api/gate/exit { studentId }  -> "बच्चा निकला (माँ-बाप के साथ)"
router.post('/exit', async (req, res) => {
  const id = req.body?.studentId;
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, 'बच्चा नहीं मिला');
  const student = await Student.findById(id);
  if (!student || !student.active) throw new HttpError(404, 'बच्चा नहीं मिला');
  const today = dayKey();
  const open = await Pickup.findOne({ student: student._id, date: today, status: { $in: pickups.OPEN } });
  if (open) {
    await pickups.refresh(open);
    if (pickups.OPEN.includes(open.status)) throw new HttpError(409, 'इस बच्चे का पिकअप चल रहा है। पहले उसे पूरा या रद्द करें।', { reason: 'PICKUP_OPEN' });
  }
  const att = await Attendance.findOneAndUpdate(
    { student: student._id, date: today, outAt: null },
    { outAt: new Date(), outBy: req.user._id, outMode: 'parent' },
    { returnDocument: 'after' }
  );
  if (!att) {
    const exists = await Attendance.exists({ student: student._id, date: today });
    throw new HttpError(409, exists ? 'बच्चा पहले ही निकल चुका है' : 'आज इस बच्चे का आना दर्ज नहीं है — पहले कार्ड स्कैन करें', { reason: exists ? 'ALREADY_LEFT' : 'NOT_IN' });
  }
  await notify({ student, kind: 'exit', data: { name: student.name, cls: student.className, time: clock(att.outAt) } });
  res.json({ event: 'left', student: studentCard(student), ...(await state(student, today)) });
});

// GET /api/gate/recent -> last scans today (guard's own log)
router.get('/recent', async (req, res) => {
  const rows = await Attendance.find({ date: dayKey() }).sort({ updatedAt: -1 }).limit(15).populate('student', 'name className photo');
  res.json({
    recent: rows
      .filter((r) => r.student)
      .map((r) => ({ studentId: String(r.student._id), name: r.student.name, className: r.className, inAt: r.inAt, outAt: r.outAt, outMode: r.outMode })),
  });
});

module.exports = router;
module.exports.studentCard = studentCard;
