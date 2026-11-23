const express = require('express');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Customer = require('../models/Customer');
const HttpError = require('../utils/httpError');
const ledger = require('../services/ledger');

const router = express.Router();

// DELETE /api/transactions/:id
router.delete('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'ग़लत ID');
  const txn = await Transaction.findByIdAndDelete(req.params.id);
  if (!txn) throw new HttpError(404, 'एंट्री नहीं मिली');
  await Customer.updateOne({ _id: txn.customer }, { $currentDate: { updatedAt: true } });
  res.json({ ok: true, customer: await ledger.getCustomerWithTotals(txn.customer) });
});

module.exports = router;
