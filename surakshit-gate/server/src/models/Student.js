const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    className: { type: String, required: true, trim: true, maxlength: 12, index: true },
    rollNo: { type: String, trim: true, maxlength: 12, default: '' },
    guardianName: { type: String, trim: true, maxlength: 60, default: '' },
    guardianPhone: { type: String, required: true, match: /^[6-9]\d{9}$/ },
    guardianLang: { type: String, enum: ['hi', 'en'], default: 'hi' }, // language of parent messages & link page
    photo: { type: String, default: '' }, // file name inside uploads/students
    // QR card: random, unguessable; shows neither name nor number
    cardToken: { type: String, required: true, unique: true },
    cardVersion: { type: Number, default: 1 },
    cardIssuedAt: { type: Date, default: Date.now },
    revokedCards: [{ tokenHash: String, revokedAt: Date, _id: false }],
    // last known state of the guardian's number (from message delivery)
    phoneStatus: { type: String, enum: ['ok', 'failed', 'unknown'], default: 'unknown' },
    phoneStatusNote: { type: String, default: '' },
    active: { type: Boolean, default: true, index: true },
    removedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
studentSchema.index({ 'revokedCards.tokenHash': 1 });

module.exports = mongoose.model('Student', studentSchema);
