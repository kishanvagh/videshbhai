const mongoose = require('mongoose');

const currencyExchangeSchema = new mongoose.Schema({
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
  exchangeDate: {
    type: Date,
    required: [true, 'Exchange date is required'],
    default: Date.now
  },
  foreignCurrency: {
    type: String,
    required: [true, 'Foreign currency is required'],
    trim: true
  },
  foreignAmountExchanged: {
    type: Number,
    required: [true, 'Foreign amount exchanged is required'],
    min: [0.01, 'Foreign amount must be greater than zero']
  },
  exchangeRate: {
    type: Number,
    required: [true, 'Exchange rate is required'],
    min: [0.0001, 'Exchange rate must be greater than zero']
  },
  grossINRAmount: {
    type: Number,
    required: [true, 'Gross INR amount is required']
  },
  exchangeFee: {
    type: Number,
    default: 0
  },
  netINRReceived: {
    type: Number,
    required: [true, 'Net INR received is required']
  },
  exchangePartyName: {
    type: String,
    trim: true
  },
  paymentReceivedPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  inrReceivedAmount: {
    type: Number,
    default: 0
  },
  inrPendingAmount: {
    type: Number,
    default: 0
  },
  bankReference: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  source: {
    type: String,
    enum: ['payment', 'opening_balance', 'external'],
    default: 'payment'
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

currencyExchangeSchema.index({ user: 1, exchangeDate: -1 });
currencyExchangeSchema.index({ user: 1, foreignCurrency: 1 });

module.exports = mongoose.model('CurrencyExchange', currencyExchangeSchema);
