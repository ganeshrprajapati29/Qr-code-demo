const mongoose = require('mongoose');

const STATUSES = ['awaiting_parent', 'approved', 'denied', 'completed', 'expired', 'cancelled', 'locked'];

const pickupSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    studentName: String,
    className: String,
    date: { type: String, required: true, index: true },
    pickerName: { type: String, required: true, maxlength: 60 },
    relation: { type: String, default: '', maxlength: 40 },
    photo: { type: String, default: '' }, // uploads/pickups file
    photoDeletedAt: { type: Date, default: null },
    guard: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    guardName: String,

    status: { type: String, enum: STATUSES, default: 'awaiting_parent', index: true },
    // OTP + parent link: random per pickup, short-lived, single use
    otpHash: { type: String, required: true },
    otpSealed: { type: String, required: true }, // readable only with the parent link token
    otpExpiresAt: { type: Date, required: true },
    otpUsedAt: { type: Date, default: null },
    parentTokenHash: { type: String, required: true, unique: true },
    linkOpenedAt: { type: Date, default: null },
    otpSentAt: { type: Date, required: true },
    round: { type: Number, default: 1 }, // increments when OTP is re-sent

    decision: { type: String, enum: ['yes', 'no', null], default: null },
    decisionAt: { type: Date, default: null },
    decisionBy: { type: String, enum: ['parent', 'office', null], default: null },
    officeUser: { type: String, default: '' },
    officeNote: { type: String, default: '' },

    wrongAttempts: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
    noResponseAlertedAt: { type: Date, default: null },
    message: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Pickup', pickupSchema);
module.exports.STATUSES = STATUSES;
