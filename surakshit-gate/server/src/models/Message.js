const mongoose = require('mongoose');

const KINDS = ['arrival', 'exit', 'pickup_request', 'pickup_done', 'alert'];
const STATUSES = ['queued', 'sent', 'delivered', 'read', 'failed'];

const messageSchema = new mongoose.Schema(
  {
    to: { type: String, required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', index: true },
    pickup: { type: mongoose.Schema.Types.ObjectId, ref: 'Pickup', default: null },
    kind: { type: String, enum: KINDS, required: true },
    text: { type: String, required: true },
    vars: { type: [String], default: [] },
    provider: { type: String, required: true },
    providerId: { type: String, default: null, index: true },
    status: { type: String, enum: STATUSES, default: 'queued' },
    error: { type: String, default: '' },
    sentAt: Date,
    deliveredAt: Date,
    readAt: Date,
    failedAt: Date,
  },
  { timestamps: true }
);
messageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
module.exports.KINDS = KINDS;
