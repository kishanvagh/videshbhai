const mongoose = require('mongoose');

const paymentAllocationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: true,
    index: true
  },
  sale: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    required: true,
    index: true
  },
  allocatedAmount: {
    type: Number,
    required: [true, 'Allocated amount is required'],
    min: [0.01, 'Allocated amount must be greater than zero']
  },
  currency: {
    type: String,
    required: [true, 'Currency is required']
  },
  allocationDate: {
    type: Date,
    default: Date.now
  },
  isCrossCurrency: {
    type: Boolean,
    default: false
  },
  exchangeRateUsed: {
    type: Number
  },
  settlementAmountInSaleCurrency: {
    type: Number
  },
  notes: {
    type: String,
    trim: true
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
  }
}, {
  timestamps: true
});

paymentAllocationSchema.index({ user: 1, payment: 1, sale: 1 });
paymentAllocationSchema.index({ user: 1, isReversed: 1 });

module.exports = mongoose.model('PaymentAllocation', paymentAllocationSchema);
