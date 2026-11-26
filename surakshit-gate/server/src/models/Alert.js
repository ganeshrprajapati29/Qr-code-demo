const mongoose = require('mongoose');

const TYPES = ['wrong_otp', 'parent_denied', 'parent_no_response', 'message_failed', 'revoked_card', 'unknown_card', 'pickup_locked', 'repeat_scan'];

const alertSchema = new mongoose.Schema(
  {
    type: { type: String, enum: TYPES, required: true },
    text: { type: String, required: true }, // Hindi
    textEn: { type: String, default: '' }, // English
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
    pickup: { type: mongoose.Schema.Types.ObjectId, ref: 'Pickup', default: null },
    className: { type: String, default: '' },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: String, default: '' },
  },
  { timestamps: true }
);
alertSchema.index({ resolvedAt: 1, createdAt: -1 });

module.exports = mongoose.model('Alert', alertSchema);
module.exports.TYPES = TYPES;
