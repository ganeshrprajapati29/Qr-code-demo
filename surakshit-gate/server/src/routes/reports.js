const express = require('express');
const HttpError = require('../utils/httpError');
const Parade = require('../models/Parade');
const { requireRole, allowedClasses } = require('../middleware/auth');
const { dayKey, isDayKey, isMonthKey } = require('../utils/time');
const { int, className } = require('../utils/validate');
const reports = require('../services/reports');

const router = express.Router();
const viewers = requireRole('admin', 'principal', 'teacher');

// GET /api/reports/today?date=YYYY-MM-DD
router.get('/today', viewers, async (req, res) => {
  const date = isDayKey(req.query.date) ? req.query.date : dayKey();
  const r = await reports.today(date, allowedClasses(req.user));
  res.json(r);
});

// GET /api/reports/monthly?month=YYYY-MM
router.get('/monthly', viewers, async (req, res) => {
  const month = isMonthKey(req.query.month) ? req.query.month : dayKey().slice(0, 7);
  res.json(await reports.monthly(month, allowedClasses(req.user), dayKey()));
});

// PUT /api/reports/parade { className, count }  -> teacher's head-count for today
router.put('/parade', viewers, async (req, res) => {
  const cls = className(req.body?.className);
  const allowed = allowedClasses(req.user);
  if (allowed && !allowed.includes(cls)) throw new HttpError(403, 'यह आपकी क्लास नहीं है', { reason: 'FORBIDDEN' });
  const count = int(req.body?.count, 'परेड गिनती', { min: 0, max: 500 });
  const date = dayKey();
  await Parade.findOneAndUpdate({ date, className: cls }, { count, by: req.user._id, byName: req.user.name }, { upsert: true, returnDocument: 'after' });
  const r = await reports.today(date, [cls]);
  res.json({ class: r.classes[0] || null });
});

module.exports = router;
