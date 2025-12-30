const mongoose = require('mongoose');

const productPricingSchema = new mongoose.Schema({
  // Product Info
  design: {
    type: String,
    required: true,
    trim: true
  },
  
  // Marketplace Account
  marketplaceAccount: {
    type: String,
    required: true,
    trim: true
  },
  
  marketplaceAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Settings.marketplaceAccounts'
  },
  
  // Pricing Details
  sellingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  
  marketplaceFees: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  
  expectedSettlement: {
    type: Number,
    required: false,  // ✅ Changed to false (will be calculated)
    min: 0
  },
  
  // Return Fees
  returnFees: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  
  // Cost & Profit
  costPrice: {
    type: Number,
    required: true,
    min: 0
  },
  
  profitPerUnit: {
    type: Number,
    required: false  // ✅ Changed to false (will be calculated)
  },
  
  // Multi-tenant
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Metadata
  createdBy: {
    type: String,
    default: 'Admin'
  }
}, {
  timestamps: true
});

// ✅ Calculate expected settlement and profit BEFORE validation
productPricingSchema.pre('validate', function(next) {
  this.expectedSettlement = this.sellingPrice - this.marketplaceFees;
  this.profitPerUnit = this.expectedSettlement - this.costPrice;
  next();
});

// Compound index to ensure unique combination of design + account per organization
productPricingSchema.index({ design: 1, marketplaceAccount: 1, organizationId: 1 }, { unique: true });

module.exports = mongoose.model('ProductPricing', productPricingSchema);
