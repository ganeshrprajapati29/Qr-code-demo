const express = require('express');
const mongoose = require('mongoose');
const Alert = require('../models/Alert');
const HttpError = require('../utils/httpError');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireRole('admin', 'principal'));

const shape = (a) => ({ id: String(a._id), type: a.type, text: a.text, className: a.className, studentId: a.student ? String(a.student) : null, pickupId: a.pickup ? String(a.pickup) : null, createdAt: a.createdAt, resolvedAt: a.resolvedAt, resolvedBy: a.resolvedBy });

router.get('/', async (req, res) => {
  const q = req.query.all === '1' ? {} : { resolvedAt: null };
  const list = await Alert.find(q).sort({ createdAt: -1 }).limit(100);
  res.json({ alerts: list.map(shape), open: await Alert.countDocuments({ resolvedAt: null }) });
});

router.post('/:id/resolve', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'नहीं मिला');
  const a = await Alert.findByIdAndUpdate(req.params.id, { resolvedAt: new Date(), resolvedBy: req.user.name }, { returnDocument: 'after' });
  if (!a) throw new HttpError(404, 'नहीं मिला');
  res.json({ alert: shape(a) });
});

router.post('/resolve-all', async (req, res) => {
  const r = await Alert.updateMany({ resolvedAt: null }, { resolvedAt: new Date(), resolvedBy: req.user.name });
  res.json({ resolved: r.modifiedCount });
});

module.exports = router;
