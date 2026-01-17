const mongoose = require('mongoose');

// Status History Schema - UPDATED
const statusHistorySchema = new mongoose.Schema({
  previousStatus: {
    type: String,
    enum: ['dispatched', 'delivered', 'returned', 'wrongreturn', 'cancelled', null],
    required: false,
    default: null
  },
  newStatus: {
    type: String,
    enum: ['dispatched','delivered', 'returned', 'wrongreturn', 'cancelled'],
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
  marketplaceOrderId: {
    type: String,
    required: false,
    trim: true,
    sparse: true,
    index: true
  },
  orderItemId: {
    type: String,
    required: false,
    trim: true,
    sparse: true,
    index: true,
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
  status: {
    type: String,
    enum: ['dispatched', 'returned', 'wrongreturn', 'cancelled'],
    default: 'dispatched'
  },
  stockRestoredAmount: {
    type: Number,
    default: 0
  },
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
  },
  deletedAt: {
    type: Date,
    default: null,
    index: true
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  deletionReason: {
    type: String
  },
  createdByUser: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    userName: String,
    userRole: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  editHistory: [{
    editedBy: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      userName: String,
      userRole: String
    },
    editedAt: {
      type: Date,
      default: Date.now
    },
    changes: {
      type: mongoose.Schema.Types.Mixed
    }
  }]
}, {
  timestamps: true
});

// ✅ OPTIMIZED INDEXES FOR PAGINATION & SEARCH
marketplaceSaleSchema.index({ organizationId: 1, deletedAt: 1, saleDate: -1 }); // Main query
marketplaceSaleSchema.index({ organizationId: 1, status: 1, saleDate: -1 }); // Filter by status
marketplaceSaleSchema.index({ organizationId: 1, accountName: 1, saleDate: -1 }); // Filter by account
marketplaceSaleSchema.index({ organizationId: 1, design: 1 }); // Search by design
marketplaceSaleSchema.index({ organizationId: 1, orderItemId: 1 }); // Search by order item ID
marketplaceSaleSchema.index({ organizationId: 1, marketplaceOrderId: 1 }); // Search by order ID

// Keep existing indexes
marketplaceSaleSchema.index({ accountName: 1, saleDate: -1 });
marketplaceSaleSchema.index({ saleDate: 1 });
marketplaceSaleSchema.index({ status: 1 });
marketplaceSaleSchema.index({ createdBy: 1 });

// TTL index for auto-deletion after 60 days
marketplaceSaleSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 5184000 });

module.exports = mongoose.model('MarketplaceSale', marketplaceSaleSchema);
