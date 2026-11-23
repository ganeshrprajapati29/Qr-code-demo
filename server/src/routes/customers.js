const express = require('express');
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const HttpError = require('../utils/httpError');
const { normalizePhone, isValidPhone } = require('../utils/phone');
const { toPaise, formatINR } = require('../utils/money');
const ledger = require('../services/ledger');
const { buildReminderText, buildLinks } = require('../services/reminder');
const { sendWhatsApp } = require('../services/whatsapp');

const router = express.Router();

function cleanName(name) {
  if (typeof name !== 'string') throw new HttpError(400, 'ग्राहक का नाम डालें');
  const n = String(name || '').replace(/\s+/g, ' ').trim();
  if (n.length < 2) throw new HttpError(400, 'नाम कम से कम 2 अक्षर का होना चाहिए');
  if (n.length > 80) throw new HttpError(400, 'नाम बहुत लंबा है');
  return n;
}

function cleanPhone(phone) {
  if (typeof phone !== 'string' && typeof phone !== 'number') throw new HttpError(400, 'मोबाइल नंबर डालें');
  const p = normalizePhone(phone);
  if (!isValidPhone(p)) throw new HttpError(400, 'सही 10 अंकों का मोबाइल नंबर डालें');
  return p;
}

function parseDate(value) {
  if (!value) return new Date();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, 'तारीख़ सही नहीं है');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d > tomorrow) throw new HttpError(400, 'आगे की तारीख़ नहीं डाल सकते');
  return d;
}

async function loadCustomer(id) {
  const c = await ledger.getCustomerWithTotals(id);
  if (!c) throw new HttpError(404, 'ग्राहक नहीं मिला');
  return c;
}

// GET /api/customers?search=&sort=balance|name|recent
router.get('/', async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.slice(0, 60) : '';
  const sort = typeof req.query.sort === 'string' ? req.query.sort : 'balance';
  res.json({ customers: await ledger.listCustomers({ search, sort }) });
});

// POST /api/customers { name, phone }
router.post('/', async (req, res) => {
  const name = cleanName(req.body?.name);
  const phone = cleanPhone(req.body?.phone);
  const created = await Customer.create({ name, phone });
  res.status(201).json({ customer: await loadCustomer(created._id) });
});

// GET /api/customers/:id  -> customer + transactions
router.get('/:id', async (req, res) => {
  const customer = await loadCustomer(req.params.id);
  const txns = await Transaction.find({ customer: customer.id }).sort({ date: -1, createdAt: -1 }).lean();
  res.json({ customer, transactions: txns.map(ledger.shapeTxn) });
});

// PATCH /api/customers/:id { name?, phone? }
router.patch('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'ग़लत ID');
  const update = {};
  if (req.body?.name !== undefined) update.name = cleanName(req.body.name);
  if (req.body?.phone !== undefined) update.phone = cleanPhone(req.body.phone);
  const doc = await Customer.findByIdAndUpdate(req.params.id, update, { runValidators: true, returnDocument: 'after' });
  if (!doc) throw new HttpError(404, 'ग्राहक नहीं मिला');
  res.json({ customer: await loadCustomer(doc._id) });
});

// POST /api/customers/:id/qr/regenerate -> new QR token (old printed card stops working)
router.post('/:id/qr/regenerate', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'ग़लत ID');
  const doc = await Customer.findByIdAndUpdate(req.params.id, { qrToken: Customer.newQrToken() }, { returnDocument: 'after' });
  if (!doc) throw new HttpError(404, 'ग्राहक नहीं मिला');
  res.json({ customer: await loadCustomer(doc._id) });
});

// DELETE /api/customers/:id  (removes the customer's entries too)
router.delete('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'ग़लत ID');
  const doc = await Customer.findByIdAndDelete(req.params.id);
  if (!doc) throw new HttpError(404, 'ग्राहक नहीं मिला');
  await Transaction.deleteMany({ customer: doc._id });
  await require('../models/ScanLog').updateMany({ customer: doc._id }, { customer: null });
  res.json({ ok: true });
});

// POST /api/customers/:id/transactions { type: 'udhar'|'jama', amount, date, note }
router.post('/:id/transactions', async (req, res) => {
  await loadCustomer(req.params.id);
  const { type, amount, date, note } = req.body || {};
  if (!Transaction.TYPES.includes(type)) throw new HttpError(400, '"उधार" या "जमा" चुनें');
  const paise = typeof amount === 'string' || typeof amount === 'number' ? toPaise(amount) : NaN;
  if (!Number.isFinite(paise) || paise <= 0) throw new HttpError(400, 'सही रक़म डालें (जैसे 250 या 99.50)');
  if (paise > 100000000) throw new HttpError(400, 'रक़म ₹10,00,000 से ज़्यादा नहीं हो सकती');

  const txn = await Transaction.create({
    customer: req.params.id,
    type,
    amount: paise,
    date: parseDate(date),
    note: typeof note === 'string' ? note.trim().slice(0, 140) : '',
  });
  await Customer.updateOne({ _id: req.params.id }, { $currentDate: { updatedAt: true } });
  res.status(201).json({ transaction: ledger.shapeTxn(txn), customer: await loadCustomer(req.params.id) });
});

// GET /api/customers/:id/reminder -> ready-made text + wa.me / sms links
router.get('/:id/reminder', async (req, res) => {
  const customer = await loadCustomer(req.params.id);
  const text = buildReminderText(customer);
  res.json({ text, ...buildLinks(customer, text), balance: customer.balance });
});

// POST /api/customers/:id/reminder/send -> sends via WhatsApp Cloud API (if configured)
router.post('/:id/reminder/send', async (req, res) => {
  const customer = await loadCustomer(req.params.id);
  if (customer.balance <= 0) throw new HttpError(400, 'इस ग्राहक का कोई बाक़ी नहीं है');
  const text = buildReminderText(customer);
  const result = await sendWhatsApp({
    phone: customer.phone,
    name: customer.name,
    amountText: formatINR(Math.round(customer.balance * 100)),
    text,
  });
  await Customer.updateOne({ _id: customer.id }, { lastReminderAt: new Date() });
  res.json({ ok: true, channel: 'whatsapp_cloud_api', ...result });
});

// POST /api/customers/:id/reminder/logged -> owner sent it manually via WhatsApp/SMS link
router.post('/:id/reminder/logged', async (req, res) => {
  const customer = await loadCustomer(req.params.id);
  await Customer.updateOne({ _id: customer.id }, { lastReminderAt: new Date() });
  res.json({ ok: true });
});

module.exports = router;
