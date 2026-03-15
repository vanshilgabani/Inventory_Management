const mongoose = require('mongoose');

// Per-account change detail stored inside each variant entry
const accountChangeSchema = new mongoose.Schema({
  accountName:         { type: String, required: true },
  previousAllocation:  { type: Number, required: true, default: 0 },
  newAllocation:       { type: Number, required: true, default: 0 },
  isNewAccount:        { type: Boolean, default: false } // true = got newAccountInitialStock
}, { _id: false });

// One variant that was re-allocated in this notification event
const notificationVariantSchema = new mongoose.Schema({
  design:   { type: String, required: true },
  color:    { type: String, required: true },
  size:     { type: String, required: true },
  totalReservedStock: { type: Number, required: true }, // reservedStock at time of allocation
  accounts: { type: [accountChangeSchema], default: [] }
}, { _id: false });

const allocationNotificationSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // What triggered this allocation run
  triggeredBy: {
    type: String,
    required: true,
    enum: ['account_empty', 'transfer', 'manual']
  },

  // Which account went to 0 (only set when triggeredBy = 'account_empty')
  triggeredByAccount: {
    type: String,
    default: null
  },

  // All variants that were re-allocated in this single run
  variants: {
    type: [notificationVariantSchema],
    default: []
  },

  // User dismisses this via the ✕ button — never auto-dismissed
  dismissed:   { type: Boolean, default: false },
  dismissedAt: { type: Date,    default: null },

  // Snapshot of settings used at time of run (for audit clarity)
  periodDaysUsed: { type: Number, required: true }

}, { timestamps: true }); // createdAt = when allocation ran

// Indexes
allocationNotificationSchema.index({ organizationId: 1, dismissed: 1, createdAt: -1 });
allocationNotificationSchema.index({ organizationId: 1, createdAt: -1 });

module.exports = mongoose.model('AllocationNotification', allocationNotificationSchema);
