const mongoose = require('mongoose');

const editSessionSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  userName: {
    type: String,
    required: true
  },
  maxChanges: {
    type: Number,
    required: true,
    default: 2
  },
  remainingChanges: {
    type: Number,
    required: true
  },
  timeWindowMinutes: {
    type: Number,
    required: true,
    default: 3
  },
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  changesLog: [{
    action: {
      type: String,
      enum: ['edit', 'delete'],
      required: true
    },
    module: {
      type: String,
      enum: ['factory', 'inventory', 'sales', 'directSales'],
      required: true
    },
    itemId: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Auto-expire sessions
editSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for quick lookups
editSessionSchema.index({ organizationId: 1, userId: 1, isActive: 1 });

module.exports = mongoose.model('EditSession', editSessionSchema);
