const config = require('../config');
const Session = require('../models/Session');
const User = require('../models/User');
const HttpError = require('../utils/httpError');
const { randomToken, sha256 } = require('../utils/crypto');

const COOKIE = 'sg_sid';

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function setCookie(res, value, maxAgeSec) {
  const parts = [`${COOKIE}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSec}`];
  if (config.cookieSecure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

async function createSession(req, res, user) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + config.sessionHours * 3600 * 1000);
  await Session.create({ tokenHash: sha256(token), user: user._id, expiresAt, ip: req.ip, userAgent: String(req.headers['user-agent'] || '').slice(0, 200) });
  setCookie(res, token, config.sessionHours * 3600);
}

async function destroySession(req, res) {
  const token = readCookie(req, COOKIE);
  if (token) await Session.deleteOne({ tokenHash: sha256(token) });
  setCookie(res, '', 0);
}

// attaches req.user when a valid session cookie is present
async function loadUser(req, res, next) {
  const token = readCookie(req, COOKIE);
  if (!token) return next();
  const session = await Session.findOne({ tokenHash: sha256(token) }).lean();
  if (!session || session.expiresAt < new Date()) return next();
  const user = await User.findById(session.user);
  if (user && user.active) req.user = user;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return next(new HttpError(401, 'कृपया लॉगिन करें', { reason: 'LOGIN_REQUIRED' }));
  next();
}

// requireRole('admin', 'principal')
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new HttpError(401, 'कृपया लॉगिन करें', { reason: 'LOGIN_REQUIRED' }));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'आपको इस हिस्से की अनुमति नहीं है', { reason: 'FORBIDDEN' }));
    next();
  };
}

// classes this user may see (null = all)
function allowedClasses(user) {
  if (user.role === 'teacher') return user.classes || [];
  return null;
}

// CSRF defence: browsers cannot send this custom header cross-site without CORS approval
function requireAppHeader(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.headers['x-sg-app'] !== '1') return next(new HttpError(403, 'अनुरोध अस्वीकार', { reason: 'BAD_ORIGIN' }));
  next();
}

module.exports = { loadUser, requireAuth, requireRole, allowedClasses, createSession, destroySession, requireAppHeader, COOKIE };
