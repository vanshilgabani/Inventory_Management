const mongoose = require('mongoose');

const skuMappingSchema = new mongoose.Schema({
  // Tenant isolation
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Account specific
  accountName: {
    type: String,
    required: false,
    index: true
  },
  
  // Marketplace SKU (exact as in CSV)
  marketplaceSKU: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  
  // Mapped inventory details
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
    enum: ['S', 'M', 'L', 'XL', 'XXL'],
    required: true
  },
  
  // Metadata
  createdBy: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    userName: String,
    userRole: String
  },
  
  lastUsedAt: {
    type: Date,
    default: Date.now
  },
  
  usageCount: {
    type: Number,
    default: 0
  },
  
  // Auto-detected or manual
  mappingSource: {
    type: String,
    enum: ['manual', 'pattern', 'suggested'],
    default: 'manual'
  },

  // ✅ NEW: Track which accounts have used this mapping
  usedByAccounts: [{
    accountName: String,
    firstUsedAt: Date,
    lastUsedAt: Date,
    usageCount: { type: Number, default: 0 }
  }]
  
}, { timestamps: true });

// Unique index: One mapping per SKU per account per tenant
skuMappingSchema.index(
  { organizationId: 1, marketplaceSKU: 1 }, 
  { unique: true }
);

// Quick lookup index
skuMappingSchema.index({ organizationId: 1, accountName: 1 });

module.exports = mongoose.model('MarketplaceSKUMapping', skuMappingSchema);
