const mongoose = require('mongoose');

// who changed what (students, users, cards, settings, restore)
const auditSchema = new mongoose.Schema({
  at: { type: Date, default: Date.now, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: String,
  action: String,
  detail: String,
});
module.exports = mongoose.model('Audit', auditSchema);
