const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  party: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Party',
    required: true,
    index: true
  },
  paymentDate: {
    type: Date,
    required: [true, 'Payment date is required'],
    default: Date.now
  },
  amountReceived: {
    type: Number,
    required: [true, 'Amount received is required'],
    min: [0.01, 'Amount received must be greater than zero']
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    enum: ['INR', 'USD', 'AUD', 'EUR', 'GBP', 'CAD', 'SGD', 'AED', 'OTHER']
  },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'cash', 'cheque', 'wire_transfer', 'upi', 'other'],
    default: 'bank_transfer'
  },
  bankReference: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  isAdvance: {
    type: Boolean,
    default: false
  },
  isReversed: {
    type: Boolean,
    default: false
  },
  reversedAt: {
    type: Date
  },
  reversalReason: {
    type: String,
    trim: true
  },
  isOpeningBalance: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

paymentSchema.index({ user: 1, party: 1 });
paymentSchema.index({ user: 1, paymentDate: -1 });
paymentSchema.index({ user: 1, currency: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
