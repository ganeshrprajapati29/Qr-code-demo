const mongoose = require('mongoose');

const scanLogSchema = new mongoose.Schema(
  {
    raw: { type: String, required: true, maxlength: 500 },
    kind: { type: String, enum: ['customer', 'text', 'link', 'unknown'], required: true },
    name: { type: String, default: '', maxlength: 160 },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

scanLogSchema.index({ createdAt: -1 });
// keep scan history for 90 days
scanLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600, name: 'ttl_90d' });

module.exports = mongoose.model('ScanLog', scanLogSchema);
