const mongoose = require('mongoose');

const supplierSyncSchema = new mongoose.Schema({
  supplierTenantId: {
    type: mongoose.Schema.Types.ObjectId,  // ✅ CORRECT
    ref: 'User',
    required: true,
    index: true
  },
  customerTenantId: {
    type: mongoose.Schema.Types.ObjectId,  // ✅ CORRECT
    ref: 'User',
    required: true,
    index: true
  },
  
  wholesaleOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WholesaleOrder',
    required: true,
    index: true
  },
  
  syncType: {
    type: String,
    enum: ['create', 'edit', 'delete'],
    required: true
  },
  
  syncedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Items that were synced
  itemsSynced: [{
    design: String,
    color: String,
    quantities: mongoose.Schema.Types.Mixed, // { M: 10, L: 20, XL: 15 }
    pricePerUnit: Number
  }],
  
  // Changes made (for edit type)
  changesMade: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  
  // Reference to customer's FactoryReceiving entries
  factoryReceivingIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FactoryReceiving'
  }],
  
    // 🆕 NEW: Status tracking
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'synced', 'failed'],
    required: true,
    default: 'pending',
    index: true
  },
  
  // 🆕 NEW: Approval tracking
  approvedBy: {
    userId: mongoose.Schema.Types.ObjectId,
    userName: String,
    userEmail: String,
    approvedAt: Date
  },
  
  // 🆕 NEW: Rejection tracking
  rejectedBy: {
    userId: mongoose.Schema.Types.ObjectId,
    userName: String,
    userEmail: String,
    rejectedAt: Date,
    reason: String
  },
  
  errorMessage: {
    type: String,
    default: null
  },
  
  // For edits - track if within 24hrs window
  editedWithin24Hours: {
    type: Boolean,
    default: true
  },
  
  metadata: {
    orderChallanNumber: String,
    orderTotalAmount: Number,
    orderDate: Date,
    buyerName: String
  }
}, {
  timestamps: true
});

// Indexes for quick lookups
supplierSyncSchema.index({ wholesaleOrderId: 1, syncType: 1 });
supplierSyncSchema.index({ customerTenantId: 1, syncedAt: -1 });
supplierSyncSchema.index({ supplierTenantId: 1, syncedAt: -1 }); 
supplierSyncSchema.index({ status: 1, syncedAt: -1 });

module.exports = mongoose.model('SupplierSync', supplierSyncSchema);
