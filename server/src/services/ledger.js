const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const { toRupees } = require('../utils/money');

// balance = total udhar - total jama  (positive => customer owes the shop)
const totalsLookup = {
  $lookup: {
    from: Transaction.collection.name,
    let: { cid: '$_id' },
    pipeline: [
      { $match: { $expr: { $eq: ['$customer', '$$cid'] } } },
      {
        $group: {
          _id: null,
          udhar: { $sum: { $cond: [{ $eq: ['$type', 'udhar'] }, '$amount', 0] } },
          jama: { $sum: { $cond: [{ $eq: ['$type', 'jama'] }, '$amount', 0] } },
          count: { $sum: 1 },
          lastDate: { $max: '$date' },
        },
      },
    ],
    as: 'totals',
  },
};

const totalsFields = {
  $addFields: {
    totalUdhar: { $ifNull: [{ $first: '$totals.udhar' }, 0] },
    totalJama: { $ifNull: [{ $first: '$totals.jama' }, 0] },
    txnCount: { $ifNull: [{ $first: '$totals.count' }, 0] },
    lastTxnDate: { $ifNull: [{ $first: '$totals.lastDate' }, null] },
  },
};

function shapeCustomer(c) {
  const balance = (c.totalUdhar || 0) - (c.totalJama || 0);
  return {
    id: String(c._id),
    name: c.name,
    phone: c.phone,
    qrToken: c.qrToken || null,
    totalUdhar: toRupees(c.totalUdhar),
    totalJama: toRupees(c.totalJama),
    balance: toRupees(balance),
    txnCount: c.txnCount || 0,
    lastTxnDate: c.lastTxnDate,
    lastReminderAt: c.lastReminderAt,
    createdAt: c.createdAt,
  };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SORTS = {
  balance: { balance: -1, name: 1 },
  name: { name: 1 },
  recent: { updatedAt: -1 },
};

async function listCustomers({ search = '', sort = 'balance' } = {}) {
  const match = {};
  const q = String(search).trim();
  if (q) {
    const or = [{ name: { $regex: escapeRegex(q), $options: 'i' } }];
    const digits = q.replace(/\D/g, '');
    if (digits.length >= 3) or.push({ phone: { $regex: escapeRegex(digits) } });
    match.$or = or;
  }

  const rows = await Customer.aggregate([
    { $match: match },
    totalsLookup,
    totalsFields,
    { $addFields: { balance: { $subtract: ['$totalUdhar', '$totalJama'] } } },
    { $sort: SORTS[sort] || SORTS.balance },
    { $project: { totals: 0 } },
  ]).collation({ locale: 'en', strength: 2 });

  return rows.map(shapeCustomer);
}

async function getCustomerWithTotals(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  const [row] = await Customer.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(String(id)) } },
    totalsLookup,
    totalsFields,
  ]);
  return row ? shapeCustomer(row) : null;
}

async function getSummary() {
  const [row] = await Transaction.aggregate([
    { $group: { _id: '$customer', bal: { $sum: { $cond: [{ $eq: ['$type', 'udhar'] }, '$amount', { $multiply: ['$amount', -1] }] } } } },
    {
      $group: {
        _id: null,
        toCollect: { $sum: { $cond: [{ $gt: ['$bal', 0] }, '$bal', 0] } },
        advance: { $sum: { $cond: [{ $lt: ['$bal', 0] }, { $multiply: ['$bal', -1] }, 0] } },
        dueCustomers: { $sum: { $cond: [{ $gt: ['$bal', 0] }, 1, 0] } },
      },
    },
  ]);
  const customers = await Customer.countDocuments();
  return {
    customers,
    dueCustomers: row ? row.dueCustomers : 0,
    toCollect: toRupees(row ? row.toCollect : 0),
    advance: toRupees(row ? row.advance : 0),
  };
}

function shapeTxn(t) {
  return {
    id: String(t._id),
    customerId: String(t.customer),
    type: t.type,
    amount: toRupees(t.amount),
    date: t.date,
    note: t.note,
    createdAt: t.createdAt,
  };
}

module.exports = { listCustomers, getCustomerWithTotals, getSummary, shapeTxn };
