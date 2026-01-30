const mongoose = require('mongoose');

const supplierSyncLogSchema = new mongoose.Schema({
  // Supplier (your org) info
  supplierOrgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Customer (tenant) info
  customerTenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Sync operation
  syncType: {
    type: String,
    enum: ['create', 'edit', 'delete'],
    required: true,
    index: true
  },
  
  // Order details
  wholesaleOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WholesaleOrder',
    required: true
  },
  
  orderChallanNumber: String,
  buyerName: String,
  itemsCount: Number,
  totalAmount: Number,
  
  // Sync result
  success: {
    type: Boolean,
    required: true,
    index: true
  },
  
  errorMessage: String,
  
  // Customer's receiving record ID (if created)
  customerReceivingId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  
  // Metadata
  syncedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  syncedBy: {
    userId: mongoose.Schema.Types.ObjectId,
    userName: String,
    userRole: String
  }
}, {
  timestamps: true
});

// Indexes
supplierSyncLogSchema.index({ supplierOrgId: 1, syncedAt: -1 });
supplierSyncLogSchema.index({ customerTenantId: 1, syncedAt: -1 });
supplierSyncLogSchema.index({ syncType: 1, success: 1 });

module.exports = mongoose.model('SupplierSyncLog', supplierSyncLogSchema);
