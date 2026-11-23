const Customer = require('../models/Customer');

// Older customers (created before QR cards existed) get a QR token.
async function backfillQrTokens() {
  // native driver query: this internal filter must not go through sanitizeFilter
  const missing = await Customer.collection
    .find({ $or: [{ qrToken: { $exists: false } }, { qrToken: null }, { qrToken: '' }] }, { projection: { _id: 1 } })
    .toArray();
  for (const c of missing) {
    await Customer.collection.updateOne({ _id: c._id }, { $set: { qrToken: Customer.newQrToken() } });
  }
  return missing.length;
}

module.exports = { backfillQrTokens };
