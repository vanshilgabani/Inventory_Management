const mongoose = require('mongoose');

const allocationChangeSchema = new mongoose.Schema({
  // Product details
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  design: {
    type: String,
    required: true
  },
  color: {
    type: String,
    required: true
  },
  size: {
    type: String,
    required: true,
    trim: true
  },

  // Account details
  accountName: {
    type: String,
    required: true
  },

  // Change details
  quantityBefore: {
    type: Number,
    required: true,
    default: 0
  },
  quantityAfter: {
    type: Number,
    required: true,
    default: 0
  },
  amountChanged: {
    type: Number,
    required: true // Positive = added, Negative = removed/borrowed
  },

  // Change type
  changeType: {
    type: String,
    required: true,
    enum: ['manualallocation', 'emergencyborrow', 'marketplacesale', 'wholesaleborrow', 'manualreturn', 'internal_transfer_out', 'internal_transfer_in']
  },

  // Related references
  relatedOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  relatedOrderType: {
    type: String,
    enum: ['wholesale', 'marketplace', null],
    default: null
  },

  // Who made the change
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Notes
  notes: {
    type: String,
    default: ''
  },

  // Organization (multi-tenancy)
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Indexes for fast queries
allocationChangeSchema.index({ organizationId: 1, createdAt: -1 });
allocationChangeSchema.index({ accountName: 1, createdAt: -1 });
allocationChangeSchema.index({ productId: 1, accountName: 1 });
allocationChangeSchema.index({ changeType: 1 });

module.exports = mongoose.model('AllocationChange', allocationChangeSchema);
