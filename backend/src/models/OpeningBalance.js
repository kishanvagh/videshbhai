const mongoose = require('mongoose');

const openingBalanceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  party: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Party',
    index: true
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    trim: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required']
  },
  balanceType: {
    type: String,
    enum: ['receivable', 'cash_held', 'payable'],
    required: [true, 'Balance type is required']
  },
  description: {
    type: String,
    trim: true
  },
  effectiveDate: {
    type: Date,
    required: [true, 'Effective date is required'],
    default: Date.now
  }
}, {
  timestamps: true
});

openingBalanceSchema.index({ user: 1, balanceType: 1 });
openingBalanceSchema.index({ user: 1, party: 1 });

module.exports = mongoose.model('OpeningBalance', openingBalanceSchema);
