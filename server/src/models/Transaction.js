const mongoose = require('mongoose');

const TYPES = ['udhar', 'jama'];

const transactionSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    type: { type: String, enum: TYPES, required: true },
    // integer paise
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'amount must be integer paise' },
    },
    date: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 140, default: '' },
  },
  { timestamps: true }
);

transactionSchema.index({ customer: 1, date: -1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
module.exports.TYPES = TYPES;
