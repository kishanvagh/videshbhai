const mongoose = require('mongoose');

const partySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Party name is required'],
    trim: true
  },
  country: {
    type: String,
    required: [true, 'Country is required'],
    default: 'India',
    trim: true
  },
  contactPerson: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  preferredCurrency: {
    type: String,
    default: 'INR',
    enum: ['INR', 'USD', 'AUD', 'EUR', 'GBP', 'CAD', 'SGD', 'AED', 'OTHER']
  },
  notes: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

partySchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Party', partySchema);
