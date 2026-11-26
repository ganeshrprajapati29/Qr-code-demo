const express = require('express');
const bcrypt = require('bcryptjs');
const { rateLimit } = require('express-rate-limit');
const User = require('../models/User');
const HttpError = require('../utils/httpError');
const { createSession, destroySession, requireAuth } = require('../middleware/auth');
const Setting = require('../models/Setting');

const router = express.Router();
const MAX_FAILS = 5;
const LOCK_MIN = 15;
// compare against a dummy hash for unknown users so timing does not reveal usernames
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'बहुत ज़्यादा कोशिशें हुईं। 10 मिनट बाद फिर कोशिश करें।', reason: 'RATE_LIMIT' },
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    throw new HttpError(400, 'यूज़रनेम और पासवर्ड डालें');
  }
  const user = await User.findOne({ username: username.trim().toLowerCase() });
  if (user && user.lockUntil && user.lockUntil > new Date()) {
    const mins = Math.ceil((user.lockUntil - Date.now()) / 60000);
    throw new HttpError(429, `बार-बार गलत पासवर्ड। यह लॉगिन ${mins} मिनट के लिए बंद है।`, { reason: 'LOCKED' });
  }
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok || !user.active) {
    if (user) {
      user.failedLogins += 1;
      if (user.failedLogins >= MAX_FAILS) {
        user.lockUntil = new Date(Date.now() + LOCK_MIN * 60000);
        user.failedLogins = 0;
      }
      await user.save();
    }
    if (user && !user.active && ok) throw new HttpError(403, 'यह लॉगिन बंद कर दिया गया है। एडमिन से संपर्क करें।', { reason: 'DISABLED' });
    throw new HttpError(401, 'यूज़रनेम या पासवर्ड गलत है', { reason: 'BAD_CREDENTIALS' });
  }
  user.failedLogins = 0;
  user.lockUntil = null;
  user.lastLoginAt = new Date();
  await user.save();
  await createSession(req, res, user);
  res.json({ user: user.toPublic() });
});

router.post('/logout', async (req, res) => {
  await destroySession(req, res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const s = await Setting.get();
  res.json({ user: req.user.toPublic(), school: { name: s.schoolName, officePhone: s.officePhone } });
});

router.post('/password', requireAuth, async (req, res) => {
  const { current, next } = req.body || {};
  if (typeof current !== 'string' || typeof next !== 'string') throw new HttpError(400, 'पासवर्ड डालें');
  if (!(await bcrypt.compare(current, req.user.passwordHash))) throw new HttpError(400, 'मौजूदा पासवर्ड गलत है');
  if (next.length < 8) throw new HttpError(400, 'नया पासवर्ड कम से कम 8 अक्षर का हो');
  req.user.passwordHash = await bcrypt.hash(next, 11);
  await req.user.save();
  res.json({ ok: true });
});

module.exports = router;
