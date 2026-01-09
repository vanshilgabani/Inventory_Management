const mongoose = require('mongoose');

const pendingRequestSchema = new mongoose.Schema(
  {
    // Request identification
    module: {
      type: String,
      enum: ['direct-sales', 'marketplace-sales', 'inventory', 'factory-receiving'],
      required: true,
    },
    action: {
      type: String,
      enum: ['edit', 'delete', 'bulk-delete'],
      required: true,
    },

    // Record information
    recordId: {
      type: String, // Can be single ID or comma-separated IDs for bulk
      required: true,
    },
    recordIdentifier: {
      type: String, // Human-readable: "Direct Sale #DS12345" or "20 Marketplace Orders"
      required: true,
    },

    // Data changes (for edit actions)
    oldData: {
      type: mongoose.Schema.Types.Mixed, // Original values
      default: null,
    },
    newData: {
      type: mongoose.Schema.Types.Mixed, // Requested changes
      default: null,
    },

    // Snapshot (for delete actions)
    recordSnapshot: {
      type: mongoose.Schema.Types.Mixed, // Full record before delete
      default: null,
    },

    // Request metadata
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'expired', 'cancelled'],
      default: 'pending',
    },
    
    // Requester info
    requestedBy: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      userName: String,
      userEmail: String,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      // Will be set to 24 hours from requestedAt
    },

    // Admin response
    reviewedBy: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      userName: String,
      userEmail: String,
    },
    reviewedAt: Date,
    
    // Rejection details
    rejectionReason: {
      type: String,
      enum: ['incorrect-data', 'duplicate-request', 'policy-violation', 'stock-unavailable', 'other'],
    },
    rejectionNote: String, // Custom message from admin

    // Conflict detection
    recordLastModifiedAt: Date, // Timestamp when request was created
    hasConflict: {
      type: Boolean,
      default: false,
    },
    conflictDetails: String,

    // Change summary for display
    changesSummary: {
      type: String, // e.g., "Customer: Amit → Amit Kumar, Qty: 5 → 7"
    },

    // Organization
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Notifications
    adminNotified: {
      type: Boolean,
      default: false,
    },
    salesUserNotified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
pendingRequestSchema.index({ status: 1, createdAt: -1 });
pendingRequestSchema.index({ organizationId: 1, status: 1 });
pendingRequestSchema.index({ 'requestedBy.userId': 1, status: 1 });
pendingRequestSchema.index({ expiresAt: 1 }); // For auto-expiry cron job
pendingRequestSchema.index({ module: 1, recordId: 1 }); // Check existing requests

// Virtual for checking if expired
pendingRequestSchema.virtual('isExpired').get(function () {
  return this.status === 'pending' && new Date() > this.expiresAt;
});

// Method to generate changes summary
pendingRequestSchema.methods.generateChangesSummary = function () {
  if (this.action === 'delete' || this.action === 'bulk-delete') {
    return `Delete ${this.recordIdentifier}`;
  }

  if (this.action === 'edit' && this.oldData && this.newData) {
    const changes = [];
    const oldData = this.oldData;
    const newData = this.newData;

    // Compare and build summary
    for (const key in newData) {
      if (oldData[key] !== newData[key]) {
        // Format nicely
        const oldValue = oldData[key] || '(empty)';
        const newValue = newData[key] || '(empty)';
        
        // Truncate long values
        const truncate = (str, len = 20) => {
          if (typeof str !== 'string') str = String(str);
          return str.length > len ? str.substring(0, len) + '...' : str;
        };

        changes.push(`${key}: ${truncate(oldValue)} → ${truncate(newValue)}`);
      }
    }

    return changes.slice(0, 3).join(', '); // Max 3 changes in summary
  }

  return 'Changes requested';
};

// Auto-generate summary before save
pendingRequestSchema.pre('save', function (next) {
  if (!this.changesSummary) {
    this.changesSummary = this.generateChangesSummary();
  }
  next();
});

module.exports = mongoose.model('PendingRequest', pendingRequestSchema);
