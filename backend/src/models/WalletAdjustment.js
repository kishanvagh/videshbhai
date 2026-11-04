const mongoose = require('mongoose');

const walletAdjustmentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    trim: true,
    uppercase: true
  },
  amount: {
    // Signed amount: positive adds to the wallet, negative reduces it.
    type: Number,
    required: [true, 'Adjustment amount is required']
  },
  reason: {
    type: String,
    trim: true
  },
  referenceNumber: {
    type: String,
    trim: true
  },
  adjustmentDate: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

walletAdjustmentSchema.index({ user: 1, currency: 1, adjustmentDate: -1 });

module.exports = mongoose.model('WalletAdjustment', walletAdjustmentSchema);