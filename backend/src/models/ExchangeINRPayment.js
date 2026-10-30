const mongoose = require('mongoose');

const exchangeINRPaymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  exchange: { type: mongoose.Schema.Types.ObjectId, ref: 'CurrencyExchange', required: true, index: true },
  paymentDate: { type: Date, required: true, default: Date.now },
  amountINR: { type: Number, required: true, min: [0.01, 'Amount must be greater than zero'] },
  notes: { type: String, trim: true },
  referenceNumber: { type: String, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('ExchangeINRPayment', exchangeINRPaymentSchema);
