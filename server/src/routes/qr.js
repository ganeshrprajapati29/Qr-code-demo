const express = require('express');
const Customer = require('../models/Customer');
const ScanLog = require('../models/ScanLog');
const HttpError = require('../utils/httpError');
const ledger = require('../services/ledger');
const { parseQr } = require('../services/qr');

const router = express.Router();

function shapeScan(s) {
  return {
    id: String(s._id),
    kind: s.kind,
    name: s.name,
    customerId: s.customer ? String(s.customer) : null,
    createdAt: s.createdAt,
  };
}

// POST /api/qr/resolve { code } -> what the QR means (customer / name / link)
router.post('/resolve', async (req, res) => {
  const code = req.body?.code;
  if (typeof code !== 'string' || !code.trim()) throw new HttpError(400, 'QR में कुछ नहीं मिला');
  if (code.length > 2000) throw new HttpError(400, 'QR का डेटा बहुत लंबा है');
  const log = req.body?.log !== false;

  const parsed = parseQr(code);
  let result;

  if (parsed.kind === 'customer') {
    const doc = await Customer.findOne({ qrToken: parsed.token }).select('_id').lean();
    if (!doc) {
      if (log) await ScanLog.create({ raw: code.slice(0, 500), kind: 'unknown', name: 'अनजान ग्राहक QR' });
      throw new HttpError(404, 'यह QR कार्ड किसी मौजूदा ग्राहक का नहीं है (शायद ग्राहक हटा दिया गया)', { reason: 'QR_CUSTOMER_NOT_FOUND' });
    }
    const customer = await ledger.getCustomerWithTotals(doc._id);
    result = { kind: 'customer', name: customer.name, customer };
  } else {
    result = { kind: parsed.kind, name: parsed.name, customer: null };
  }

  let scan = null;
  if (log) {
    scan = await ScanLog.create({
      raw: code.slice(0, 500),
      kind: result.kind,
      name: result.name,
      customer: result.customer ? result.customer.id : null,
    });
  }
  res.json({ ...result, raw: code, scan: scan ? shapeScan(scan) : null });
});

// GET /api/qr/scans?limit=10 -> recent scan history
router.get('/scans', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  const scans = await ScanLog.find().sort({ createdAt: -1 }).limit(limit).lean();
  res.json({ scans: scans.map(shapeScan) });
});

// DELETE /api/qr/scans -> clear history
router.delete('/scans', async (req, res) => {
  await ScanLog.deleteMany({});
  res.json({ ok: true });
});

module.exports = router;
