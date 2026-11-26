const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Session = require('../models/Session');
const HttpError = require('../utils/httpError');
const { requireRole } = require('../middleware/auth');
const { str, className } = require('../utils/validate');
const { audit } = require('../services/audit');

const router = express.Router();
router.use(requireRole('admin'));

function password(v) {
  if (typeof v !== 'string' || v.length < 8 || v.length > 100) throw new HttpError(400, 'पासवर्ड कम से कम 8 अक्षर का हो');
  return v;
}
function role(v) {
  if (!User.ROLES.includes(v)) throw new HttpError(400, 'भूमिका चुनें');
  return v;
}
function classes(v) {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw new HttpError(400, 'क्लास की सूची सही नहीं');
  return [...new Set(v.map(className))];
}
async function load(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'यूज़र नहीं मिला');
  const u = await User.findById(id);
  if (!u) throw new HttpError(404, 'यूज़र नहीं मिला');
  return u;
}

router.get('/', async (req, res) => {
  const users = await User.find().sort({ role: 1, name: 1 });
  res.json({ users: users.map((u) => u.toPublic()) });
});

router.post('/', async (req, res) => {
  const b = req.body || {};
  const username = str(b.username, 'यूज़रनेम', { min: 3, max: 30 }).toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new HttpError(400, 'यूज़रनेम में सिर्फ a-z, 0-9, . _ - हों');
  const r = role(b.role);
  const u = await User.create({
    name: str(b.name, 'नाम', { min: 2, max: 60 }),
    username,
    role: r,
    classes: r === 'teacher' ? classes(b.classes) : [],
    passwordHash: await bcrypt.hash(password(b.password), 11),
  });
  await audit(req, 'user.add', `${u.username} (${u.role})`);
  res.status(201).json({ user: u.toPublic() });
});

router.patch('/:id', async (req, res) => {
  const u = await load(req.params.id);
  const b = req.body || {};
  const self = String(u._id) === String(req.user._id);
  if (b.name !== undefined) u.name = str(b.name, 'नाम', { min: 2, max: 60 });
  if (b.role !== undefined) {
    if (self && b.role !== 'admin') throw new HttpError(400, 'आप अपनी एडमिन भूमिका नहीं हटा सकते');
    u.role = role(b.role);
  }
  if (b.classes !== undefined) u.classes = classes(b.classes);
  if (u.role !== 'teacher') u.classes = [];
  if (b.active !== undefined) {
    if (self && b.active === false) throw new HttpError(400, 'आप खुद का लॉगिन बंद नहीं कर सकते');
    u.active = Boolean(b.active);
  }
  if (b.password !== undefined) {
    u.passwordHash = await bcrypt.hash(password(b.password), 11);
    u.failedLogins = 0;
    u.lockUntil = null;
  }
  await u.save();
  // disabled user or reset password -> logged out everywhere
  if (!self && (!u.active || b.password !== undefined)) await Session.deleteMany({ user: u._id });
  await audit(req, 'user.edit', `${u.username}: ${Object.keys(b).filter((k) => k !== 'password').join(', ')}${b.password ? ', password' : ''}`);
  res.json({ user: u.toPublic() });
});

module.exports = router;
