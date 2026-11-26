const Student = require('../models/Student');
const { randomToken, sha256 } = require('../utils/crypto');

// QR content printed on the card. Random, reveals nothing about the child.
const PREFIX = 'SG1.';
const newCardToken = () => randomToken(18);
const qrContent = (token) => PREFIX + token;

function parseQr(raw) {
  const s = String(raw || '').trim();
  if (!s.startsWith(PREFIX)) return null;
  const token = s.slice(PREFIX.length);
  return /^[A-Za-z0-9_-]{16,64}$/.test(token) ? token : null;
}

// lost card: old token stops working, a new one is issued
async function reissueCard(student) {
  student.revokedCards.push({ tokenHash: sha256(student.cardToken), revokedAt: new Date() });
  student.cardToken = newCardToken();
  student.cardVersion += 1;
  student.cardIssuedAt = new Date();
  await student.save();
  return student;
}

async function findByCard(token) {
  const student = await Student.findOne({ cardToken: token });
  if (student) return { student, revoked: false };
  const old = await Student.findOne({ 'revokedCards.tokenHash': sha256(token) });
  if (old) return { student: old, revoked: true };
  return { student: null, revoked: false };
}

module.exports = { newCardToken, qrContent, parseQr, reissueCard, findByCard, PREFIX };
