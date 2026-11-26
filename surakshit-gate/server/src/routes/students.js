const express = require('express');
const mongoose = require('mongoose');
const Student = require('../models/Student');
const HttpError = require('../utils/httpError');
const { str, className } = require('../utils/validate');
const { normalizePhone, isValidPhone } = require('../utils/phone');
const { requireRole } = require('../middleware/auth');
const { saveImage, removeImage, sendImage } = require('../services/photos');
const { newCardToken, qrContent, reissueCard } = require('../services/cards');
const { parseCsv, mapHeader } = require('../services/csv');
const { audit } = require('../services/audit');

const router = express.Router();
const managers = requireRole('admin', 'principal');

function shape(s, { withCard = false } = {}) {
  const o = {
    id: String(s._id),
    name: s.name,
    className: s.className,
    rollNo: s.rollNo,
    guardianName: s.guardianName,
    guardianPhone: s.guardianPhone,
    photoUrl: s.photo ? `/api/students/${s._id}/photo?v=${encodeURIComponent(s.photo)}` : null,
    cardVersion: s.cardVersion,
    cardIssuedAt: s.cardIssuedAt,
    phoneStatus: s.phoneStatus,
    phoneStatusNote: s.phoneStatusNote,
    active: s.active,
  };
  if (withCard) o.qr = qrContent(s.cardToken);
  return o;
}

function phone(v) {
  const p = normalizePhone(typeof v === 'string' || typeof v === 'number' ? v : '');
  if (!isValidPhone(p)) throw new HttpError(400, 'माँ-बाप का सही 10 अंकों का मोबाइल नंबर डालें');
  return p;
}

async function load(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'बच्चा नहीं मिला');
  const s = await Student.findById(id);
  if (!s) throw new HttpError(404, 'बच्चा नहीं मिला');
  return s;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /api/students?class=5A&search=&inactive=1
router.get('/', managers, async (req, res) => {
  const filter = { active: req.query.inactive === '1' ? false : true };
  if (typeof req.query.class === 'string' && req.query.class) filter.className = req.query.class.toUpperCase();
  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    const q = escapeRegex(req.query.search.trim().slice(0, 40));
    filter.$or = [{ name: { $regex: q, $options: 'i' } }, { guardianPhone: { $regex: q } }, { rollNo: { $regex: q, $options: 'i' } }];
  }
  const list = await Student.find(filter).sort({ className: 1, rollNo: 1, name: 1 }).collation({ locale: 'en', numericOrdering: true });
  res.json({ students: list.map((s) => shape(s)) });
});

// GET /api/students/classes -> [{ className, count }]
router.get('/classes', requireRole('admin', 'principal', 'teacher'), async (req, res) => {
  const rows = await Student.aggregate([{ $match: { active: true } }, { $group: { _id: '$className', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
  let classes = rows.map((r) => ({ className: r._id, count: r.count }));
  if (req.user.role === 'teacher') classes = classes.filter((c) => req.user.classes.includes(c.className));
  res.json({ classes });
});

// GET /api/students/cards?class=5A  (or ?ids=a,b) -> data for printable cards
router.get('/cards', managers, async (req, res) => {
  const filter = { active: true };
  if (typeof req.query.class === 'string' && req.query.class) filter.className = req.query.class.toUpperCase();
  if (typeof req.query.ids === 'string' && req.query.ids) {
    const ids = req.query.ids.split(',').filter((x) => mongoose.isValidObjectId(x));
    filter._id = { $in: ids };
  }
  const list = await Student.find(filter).sort({ className: 1, rollNo: 1, name: 1 }).collation({ locale: 'en', numericOrdering: true });
  res.json({ students: list.map((s) => shape(s, { withCard: true })) });
});

router.get('/:id', managers, async (req, res) => {
  res.json({ student: shape(await load(req.params.id), { withCard: true }) });
});

// photo for staff screens (guard sees it at the gate)
router.get('/:id/photo', requireRole('admin', 'principal', 'teacher', 'guard'), async (req, res) => {
  const s = await load(req.params.id);
  if (!s.photo) throw new HttpError(404, 'फोटो नहीं है');
  await sendImage(res, 'students', s.photo);
});

router.post('/', managers, async (req, res) => {
  const b = req.body || {};
  const data = {
    name: str(b.name, 'बच्चे का नाम', { min: 2, max: 80 }),
    className: className(b.className),
    rollNo: str(b.rollNo, 'रोल नंबर', { max: 12, optional: true }),
    guardianName: str(b.guardianName, 'अभिभावक का नाम', { max: 60, optional: true }),
    guardianPhone: phone(b.guardianPhone),
    cardToken: newCardToken(),
  };
  if (b.photo) data.photo = await saveImage('students', b.photo);
  const s = await Student.create(data);
  await audit(req, 'student.add', `${s.name} (${s.className})`);
  res.status(201).json({ student: shape(s, { withCard: true }) });
});

router.patch('/:id', managers, async (req, res) => {
  const s = await load(req.params.id);
  const b = req.body || {};
  if (b.name !== undefined) s.name = str(b.name, 'बच्चे का नाम', { min: 2, max: 80 });
  if (b.className !== undefined) s.className = className(b.className);
  if (b.rollNo !== undefined) s.rollNo = str(b.rollNo, 'रोल नंबर', { max: 12, optional: true });
  if (b.guardianName !== undefined) s.guardianName = str(b.guardianName, 'अभिभावक का नाम', { max: 60, optional: true });
  if (b.guardianPhone !== undefined) {
    const p = phone(b.guardianPhone);
    if (p !== s.guardianPhone) {
      s.guardianPhone = p;
      s.phoneStatus = 'unknown';
      s.phoneStatusNote = '';
    }
  }
  if (b.photo) {
    const old = s.photo;
    s.photo = await saveImage('students', b.photo);
    if (old) await removeImage('students', old);
  }
  await s.save();
  await audit(req, 'student.edit', `${s.name} (${s.className})`);
  res.json({ student: shape(s, { withCard: true }) });
});

// remove = archive (history stays in reports), card stops working
router.delete('/:id', managers, async (req, res) => {
  const s = await load(req.params.id);
  if (!s.active) return res.json({ ok: true });
  s.active = false;
  s.removedAt = new Date();
  await reissueCard(s); // revokes the printed card
  await audit(req, 'student.remove', `${s.name} (${s.className})`);
  res.json({ ok: true });
});

router.post('/:id/restore', managers, async (req, res) => {
  const s = await load(req.params.id);
  s.active = true;
  s.removedAt = null;
  await s.save();
  await audit(req, 'student.restore', s.name);
  res.json({ student: shape(s, { withCard: true }) });
});

// lost card -> old QR blocked, new QR issued
router.post('/:id/new-card', managers, async (req, res) => {
  const s = await load(req.params.id);
  if (!s.active) throw new HttpError(400, 'हटाए गए बच्चे का कार्ड नहीं बन सकता');
  await reissueCard(s);
  await audit(req, 'card.reissue', `${s.name} (${s.className}) v${s.cardVersion}`);
  res.json({ student: shape(s, { withCard: true }) });
});

// POST /api/students/import { csv, dryRun }
router.post('/import', managers, async (req, res) => {
  const { csv, dryRun } = req.body || {};
  if (typeof csv !== 'string' || !csv.trim()) throw new HttpError(400, 'CSV फ़ाइल खाली है');
  if (csv.length > 500000) throw new HttpError(400, 'फ़ाइल बहुत बड़ी है');
  const rows = parseCsv(csv);
  if (rows.length < 2) throw new HttpError(400, 'CSV में हेडर और कम से कम एक बच्चा होना चाहिए');
  const idx = mapHeader(rows[0]);
  for (const f of ['name', 'className', 'guardianPhone']) {
    if (idx[f] === undefined) throw new HttpError(400, 'CSV के पहले लाइन में ये कॉलम होने चाहिए: name, class, mobile');
  }
  const ok = [];
  const errors = [];
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    try {
      ok.push({
        name: str(r[idx.name], 'नाम', { min: 2, max: 80 }),
        className: className(r[idx.className]),
        guardianPhone: phone(r[idx.guardianPhone]),
        guardianName: idx.guardianName !== undefined ? str(r[idx.guardianName], 'अभिभावक', { max: 60, optional: true }) : '',
        rollNo: idx.rollNo !== undefined ? str(r[idx.rollNo], 'रोल', { max: 12, optional: true }) : '',
      });
    } catch (e) {
      errors.push({ line, error: e.message });
    }
  });
  if (ok.length > 2000) throw new HttpError(400, 'एक बार में 2000 बच्चों तक जोड़ें');
  if (dryRun || errors.length) return res.json({ dryRun: true, valid: ok.length, errors, preview: ok.slice(0, 5) });
  const docs = await Student.insertMany(ok.map((d) => ({ ...d, cardToken: newCardToken() })));
  await audit(req, 'student.import', `${docs.length} बच्चे`);
  res.status(201).json({ imported: docs.length, errors: [] });
});

module.exports = router;
