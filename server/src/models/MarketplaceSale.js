const mongoose = require('mongoose');

// Status History Schema - UPDATED
const statusHistorySchema = new mongoose.Schema({
  previousStatus: {
    type: String,
    enum: ['dispatched', 'delivered', 'returned', 'wrongreturn', 'cancelled', null], // Keep delivered here for history
    required: false,
    default: null
  },
  newStatus: {
    type: String,
    enum: ['dispatched', 'delivered', 'returned', 'wrongreturn', 'cancelled'], // ✅ REMOVED 'delivered'
    required: true
  },
  changedBy: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: null
    },
    userName: {
      type: String,
      required: true
    },
    userRole: {
      type: String,
      required: true
    }
  },
  changedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  comments: {
    type: String,
    default: ''
  }
}, { _id: false });

const marketplaceSaleSchema = new mongoose.Schema({
  accountName: {
    type: String,
    required: true
  },
  // Marketplace Order ID (Flipkart/Amazon/Meesho)
  marketplaceOrderId: {
    type: String,
    required: false,
    trim: true,
    sparse: true,
    index: true
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
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  saleDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  // ✅ UPDATED - Removed 'delivered', default is 'dispatched'
  status: {
    type: String,
    enum: ['dispatched', 'returned', 'wrongreturn', 'cancelled'], // ✅ REMOVED 'delivered'
    default: 'dispatched'
  },
  // NEW FIELD - Tracks if stock was restored and how much
  stockRestoredAmount: {
    type: Number,
    default: 0
  },
  // Status change history
  statusHistory: {
    type: [statusHistorySchema],
    default: []
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  notes: {
    type: String,
    default: ''
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
marketplaceSaleSchema.index({ accountName: 1, saleDate: -1 });
marketplaceSaleSchema.index({ organizationId: 1, accountName: 1 });
marketplaceSaleSchema.index({ organizationId: 1, accountName: 1, marketplaceOrderId: 1 });
marketplaceSaleSchema.index({ saleDate: 1 });
marketplaceSaleSchema.index({ status: 1 });
marketplaceSaleSchema.index({ createdBy: 1 });
marketplaceSaleSchema.index({ marketplaceOrderId: 1 });

module.exports = mongoose.model('MarketplaceSale', marketplaceSaleSchema);
