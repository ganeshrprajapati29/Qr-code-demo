const config = require('../../config');
const Message = require('../../models/Message');
const Student = require('../../models/Student');
const Alert = require('../../models/Alert');
const Setting = require('../../models/Setting');
const texts = require('../texts');

const providers = { demo: require('./demo'), whatsapp: require('./whatsapp') };
const provider = () => providers[config.messages.provider] || providers.demo;

const RANK = { queued: 0, sent: 1, delivered: 2, read: 3 };

// status never goes backwards (read -> delivered), failed is terminal
async function updateStatus(msgOrId, status, { error = '', numberProblem = false, at = new Date() } = {}) {
  // note: a mongoose ObjectId also has an `_id` getter, so check for a real document
  const msg = msgOrId instanceof Message ? msgOrId : msgOrId ? await Message.findById(msgOrId) : null;
  if (!msg || msg.status === 'failed') return msg;
  if (status !== 'failed' && RANK[status] <= RANK[msg.status]) return msg;
  msg.status = status;
  if (status === 'sent') msg.sentAt = at;
  if (status === 'delivered') { msg.deliveredAt = at; msg.sentAt ||= at; }
  if (status === 'read') { msg.readAt = at; msg.deliveredAt ||= at; msg.sentAt ||= at; }
  if (status === 'failed') { msg.failedAt = at; msg.error = String(error).slice(0, 300); }
  await msg.save();

  if (msg.student) {
    if (status === 'failed') {
      const student = await Student.findById(msg.student);
      if (student) {
        student.phoneStatus = 'failed';
        student.phoneStatusNote = numberProblem ? 'नंबर गलत या बंद है' : 'मैसेज नहीं पहुँचा';
        await student.save();
        await Alert.create({
          type: 'message_failed',
          student: student._id,
          className: student.className,
          pickup: msg.pickup,
          text: `${student.name} (${student.className}) के माँ-बाप (${student.guardianPhone}) को मैसेज नहीं पहुँचा: ${student.phoneStatusNote}। नंबर जाँचें।`,
        });
      }
    } else if (status === 'delivered' || status === 'read') {
      await Student.updateOne({ _id: msg.student, phoneStatus: { $ne: 'ok' } }, { phoneStatus: 'ok', phoneStatusNote: '' });
    }
  }
  return msg;
}

// Creates the message record and sends it in the background (gate screen never waits on the network).
async function notify({ student, kind, data, pickup = null, to }) {
  const s = await Setting.get();
  const { text, vars } = texts[kind]({ school: s.schoolName, ...data });
  const p = provider();
  const msg = await Message.create({ to: to || student.guardianPhone, student: student?._id, pickup, kind, text, vars, provider: p.name, status: 'queued' });
  const job = (async () => {
    try {
      const r = await p.send(msg);
      msg.providerId = r.providerId;
      await updateStatus(msg, 'sent');
      if (r.deliverAfterMs !== undefined) {
        setTimeout(() => updateStatus(msg._id, 'delivered').catch(() => {}), r.deliverAfterMs).unref?.();
      }
    } catch (e) {
      await updateStatus(msg, 'failed', { error: e.message, numberProblem: e.numberProblem });
    }
  })();
  notify.pending.add(job);
  job.finally(() => notify.pending.delete(job));
  return msg;
}
notify.pending = new Set();
notify.flush = () => Promise.all([...notify.pending]);

function shapeMessage(m) {
  if (!m) return null;
  return { id: String(m._id), kind: m.kind, status: m.status, error: m.error, sentAt: m.sentAt, deliveredAt: m.deliveredAt, readAt: m.readAt, createdAt: m.createdAt };
}

module.exports = { notify, updateStatus, shapeMessage, provider };
