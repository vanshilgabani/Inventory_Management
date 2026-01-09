const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  module: {
    type: String,
    required: true,
    enum: ['marketplace-sales', 'direct-sales', 'inventory', 'wholesale', 'factory']
  },
  actionType: {
    type: String,
    required: true,
    enum: ['create', 'edit', 'delete']
  },
  recordId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  beforeState: {
    type: mongoose.Schema.Types.Mixed
  },
  afterState: {
    type: mongoose.Schema.Types.Mixed
  },
  changes: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed
  }],
  timestamp: {
    type: Date,
    default: Date.now
  },
  undone: {
    type: Boolean,
    default: false
  },
  undoneAt: {
    type: Date
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EditSession'
  },
  description: {
    type: String
  }
});

// Indexes for faster queries
activityLogSchema.index({ userId: 1, timestamp: -1 });
activityLogSchema.index({ module: 1, timestamp: -1 });
activityLogSchema.index({ undone: 1, timestamp: -1 });
activityLogSchema.index({ recordId: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
