const mongoose = require('mongoose');

// teacher's head-count for a class on a day
const paradeSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    className: { type: String, required: true },
    count: { type: Number, required: true, min: 0 },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    byName: String,
  },
  { timestamps: true }
);
paradeSchema.index({ date: 1, className: 1 }, { unique: true });

module.exports = mongoose.model('Parade', paradeSchema);
