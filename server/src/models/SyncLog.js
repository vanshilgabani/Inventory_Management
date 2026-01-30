// models/SyncLog.js
const mongoose = require('mongoose');

const syncLogSchema = new mongoose.Schema({
  // Supplier order reference (your wholesale order)
  supplierOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WholesaleOrder',
    required: true
  },
  supplierChallanNumber: String,

  // Tenant (buyer) reference
  tenantUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tenantOrganizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Tenant's factory receiving record
  tenantFactoryReceivingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FactoryReceiving',
    default: null
  },

  // Sync action
  action: {
    type: String,
    enum: ['create', 'update', 'delete'],
    required: true
  },

  // Sync status
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'reversed'],
    default: 'pending'
  },

  // Items synced
  itemsSynced: [{
    design: String,
    color: String,
    size: String,
    quantity: Number,
    pricePerUnit: Number
  }],

  // Order metadata
  orderDetails: {
    challanNumber: String,
    orderDate: Date,
    totalAmount: Number,
    subtotal: Number,
    gstAmount: Number
  },

  // Sync timestamps
  syncedAt: Date,
  syncedWithin24Hours: { type: Boolean, default: true },

  // Tenant response
  tenantResponse: {
    accepted: { type: Boolean, default: null },
    acceptedAt: Date,
    issues: [{
      item: String,
      issueType: {
        type: String,
        enum: ['damaged', 'short-quantity', 'wrong-item', 'other']
      },
      reportedQuantity: Number,
      notes: String
    }]
  },

  // Error tracking
  error: String,

  // Organization (supplier's org)
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

// Indexes
syncLogSchema.index({ supplierOrderId: 1 });
syncLogSchema.index({ tenantUserId: 1, createdAt: -1 });
syncLogSchema.index({ status: 1 });
syncLogSchema.index({ organizationId: 1 });

module.exports = mongoose.model('SyncLog', syncLogSchema);
