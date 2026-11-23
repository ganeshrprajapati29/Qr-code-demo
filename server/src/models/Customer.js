const crypto = require('crypto');
const mongoose = require('mongoose');

const newQrToken = () => crypto.randomBytes(8).toString('base64url');

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, unique: true, match: /^[6-9]\d{9}$/ },
    lastReminderAt: { type: Date, default: null },
    // random id printed in the customer's QR card (never the DB id)
    qrToken: { type: String, unique: true, sparse: true, default: newQrToken },
  },
  { timestamps: true }
);

customerSchema.index({ name: 1 });

module.exports = mongoose.model('Customer', customerSchema);
module.exports.newQrToken = newQrToken;
