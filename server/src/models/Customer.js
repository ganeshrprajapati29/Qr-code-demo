const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, unique: true, match: /^[6-9]\d{9}$/ },
    lastReminderAt: { type: Date, default: null },
  },
  { timestamps: true }
);

customerSchema.index({ name: 1 });

module.exports = mongoose.model('Customer', customerSchema);
