const mongoose = require('mongoose');

// Status History Schema - UPDATED
const statusHistorySchema = new mongoose.Schema({
  previousStatus: {
    type: String,
    enum: ['dispatched', 'delivered', 'returned', 'wrongreturn', 'cancelled', 'RTO',null],
    required: false,
    default: null
  },
  newStatus: {
    type: String,
    enum: ['dispatched','delivered', 'returned', 'wrongreturn', 'cancelled', 'RTO'],
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
  trackingId: {
    type: String,
    default: null,
    trim: true
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
    enum: ['dispatched', 'returned', 'wrongreturn', 'cancelled', 'RTO'],
    default: 'dispatched'
  },

  returnTrackingId: {
    type: String,
    default: null,
    trim: true,
  },
  returnId: {
    type: String,
    default: null,
    trim: true,
  },
  returnType: {
    type: String,
    default: null,
    trim: true,
    // e.g. "Customer Return", "Seller RTO", "Return", etc.
  },
  returnReason: {
    type: String,
    default: null,
    trim: true,
  },
  returnSubReason: {
    type: String,
    default: null,
    trim: true,
  },
  returnComments: {
    type: String,
    default: null,
    trim: true,
  },
  returnStatus: {
    type: String,
    default: null,
    trim: true,
  },
  returnRequestedDate: {
    type: Date,
    default: null,
  },
  returnCompletedDate: {
    type: Date,
    default: null,
  },
  stockRestoredAmount: {
    type: Number,
    default: 0
  },
  returnedProduct: {
    design:   { type: String, default: null },
    color:    { type: String, default: null },
    size:     { type: String, default: null },
    quantity: { type: Number, default: null }
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

  tenantId: {
    type: String,
    required: true,
    index: true
  },

  // Track which inventory was used
  inventoryModeUsed: {
    type: String,
    enum: ['main', 'reserved'],
    default: 'reserved'
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
