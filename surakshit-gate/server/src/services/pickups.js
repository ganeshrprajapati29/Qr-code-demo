const Pickup = require('../models/Pickup');
const Alert = require('../models/Alert');
const Setting = require('../models/Setting');
const Message = require('../models/Message');
const { shapeMessage } = require('./notify');

const OTP_LEN = 4;
const MAX_WRONG = 5;
const OPEN = ['awaiting_parent', 'approved'];

// moves an open pickup to "expired" once its OTP time is over; raises the no-response alert
async function refresh(p, settings) {
  const now = new Date();
  if (OPEN.includes(p.status) && p.otpExpiresAt <= now) {
    p.status = 'expired';
    await p.save();
  }
  if (p.status === 'awaiting_parent' && !p.noResponseAlertedAt) {
    const s = settings || (await Setting.get());
    if (now - p.otpSentAt >= s.parentTimeoutMin * 60000) {
      p.noResponseAlertedAt = now;
      await p.save();
      await Alert.create({
        type: 'parent_no_response',
        student: p.student,
        pickup: p._id,
        className: p.className,
        text: `${p.studentName} (${p.className}) के पिकअप पर माँ-बाप ने ${s.parentTimeoutMin} मिनट में जवाब नहीं दिया। ऑफिस से फोन करके पुष्टि करें।`,
      });
    }
  }
  return p;
}

async function shape(p, { settings, forOffice = false, guardianPhone } = {}) {
  const s = settings || (await Setting.get());
  await refresh(p, s);
  const msg = p.message ? await Message.findById(p.message) : null;
  const now = Date.now();
  const noResponse = p.status === 'awaiting_parent' && now - p.otpSentAt >= s.parentTimeoutMin * 60000;
  return {
    id: String(p._id),
    studentId: String(p.student),
    studentName: p.studentName,
    className: p.className,
    date: p.date,
    pickerName: p.pickerName,
    relation: p.relation,
    photoUrl: p.photo && !p.photoDeletedAt ? `/api/pickups/${p._id}/photo` : null,
    photoDeleted: Boolean(p.photoDeletedAt),
    guardName: p.guardName,
    status: p.status,
    decision: p.decision,
    decisionAt: p.decisionAt,
    decisionBy: p.decisionBy,
    officeUser: p.officeUser,
    officeNote: p.officeNote,
    otpSentAt: p.otpSentAt,
    otpExpiresAt: p.otpExpiresAt,
    secondsLeft: OPEN.includes(p.status) ? Math.max(0, Math.round((p.otpExpiresAt - now) / 1000)) : 0,
    linkOpenedAt: p.linkOpenedAt,
    wrongAttempts: p.wrongAttempts,
    attemptsLeft: Math.max(0, MAX_WRONG - p.wrongAttempts),
    completedAt: p.completedAt,
    round: p.round,
    message: shapeMessage(msg),
    noResponse,
    officePhone: s.officePhone,
    parentTimeoutMin: s.parentTimeoutMin,
    guardianPhone: forOffice ? guardianPhone : undefined,
    createdAt: p.createdAt,
  };
}

module.exports = { refresh, shape, OTP_LEN, MAX_WRONG, OPEN, Pickup };
