const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
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
  invoiceNumber: {
    type: String,
    required: [true, 'Invoice number is required'],
    trim: true
  },
  saleDate: {
    type: Date,
    required: [true, 'Sale date is required'],
    default: Date.now
  },
  productName: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  productDescription: {
    type: String,
    trim: true
  },
  quantity: {
    type: Number,
    default: 1,
    min: 0
  },
  saleAmountINR: {
    type: Number,
    default: 0,
    min: 0
  },
  homePriceCurrency: {
    type: String,
    default: 'INR',
    enum: ['INR', 'USD']
  },
  saleAmountForeign: {
    type: Number,
    default: 0,
    min: 0
  },
  foreignCurrency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'INR', 'AUD', 'EUR', 'GBP', 'CAD', 'SGD', 'AED', 'OTHER']
  },
  estimatedProfitINR: {
    type: Number,
    default: 0
  },
  estimatedProfitForeign: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'partial', 'settled', 'cancelled'],
    default: 'active'
  },
  notes: {
    type: String,
    trim: true
  },
  cancelledAt: {
    type: Date
  },
  cancelledReason: {
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

saleSchema.index({ user: 1, invoiceNumber: 1 }, { unique: true });
saleSchema.index({ user: 1, party: 1 });
saleSchema.index({ user: 1, saleDate: -1 });

module.exports = mongoose.model('Sale', saleSchema);
