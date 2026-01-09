const mongoose = require('mongoose');

const permissionRequestSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requesterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requesterName: String,
  requesterEmail: String,
  
  // Request details
  reason: String,
  requestedAt: { type: Date, default: Date.now },
  
  // Default settings from Settings schema
  suggestedMaxChanges: Number,
  suggestedTimeWindowMinutes: Number,
  suggestedPermissionLevel: String,
  
  // Response
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'denied', 'expired'],
    default: 'pending'
  },
  respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  respondedAt: Date,
  
  // Final granted permissions (if approved)
  grantedMaxChanges: Number,
  grantedTimeWindowMinutes: Number,
  grantedPermissionLevel: String,
  
  // Session created
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'EditSession' },
  
  // Auto-expire pending requests after 5 minutes
  expiresAt: { type: Date, required: true }

}, { timestamps: true });

// Auto-expire index
permissionRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
permissionRequestSchema.index({ organizationId: 1, status: 1 });

module.exports = mongoose.model('PermissionRequest', permissionRequestSchema);
