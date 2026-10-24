const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  entityType: {
    type: String,
    required: true,
    trim: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  action: {
    type: String,
    enum: ['create', 'update', 'cancel', 'reverse', 'allocate', 'deallocate'],
    required: true
  },
  before: {
    type: mongoose.Schema.Types.Mixed
  },
  after: {
    type: mongoose.Schema.Types.Mixed
  },
  performedAt: {
    type: Date,
    default: Date.now
  },
  ip: {
    type: String
  }
}, {
  timestamps: false
});

auditLogSchema.index({ user: 1, performedAt: -1 });
auditLogSchema.index({ user: 1, entityType: 1, entityId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
