const mongoose = require('mongoose');

const sizeStockSchema = new mongoose.Schema({
  size: {
    type: String,
    trim: true,
    uppercase: true,
    required: true,
  },
  currentStock: {
    type: Number,
    default: 0,
    min: 0,
  },
  reservedStock: {
    type: Number,
    default: 0,
  },
  // ✅ NEW: Account-wise allocations
  reservedAllocations: [{
    accountName: { type: String, required: true },
    quantity: { type: Number, default: 0, min: 0 },
    allocatedAt: { type: Date, default: Date.now }, // ✅ NEW FIELD
    updatedAt: { type: Date, default: Date.now }
  }],
  lockedStock: {
    type: Number,
    default: 0,
    min: 0,
  },
  reorderPoint: {
    type: Number,
    default: 20,
  },
});

const colorVariantSchema = new mongoose.Schema({
  color: {
    type: String,
    required: true,
  },
  sizes: [sizeStockSchema],
  wholesalePrice: {
    type: Number,
    default: 0,
    min: 0,
  },
  retailPrice: {
    type: Number,
    default: 0,
    min: 0,
  },
});

const productSchema = new mongoose.Schema(
  {
    design: {
      type: String,
      required: [true, 'Design name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    colors: [colorVariantSchema],
    // Track if product was created via supplier sync
    syncedFromSupplier: {
      type: Boolean,
      default: false,
    },
    supplierProductId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null, // Original product ID from supplier's inventory
    },
    // ✅ UPDATED: Multi-account Flipkart Integration
    flipkart: {
      enabled: { type: Boolean, default: false },
      // ✅ NEW: Account-specific mappings
      accountMappings: [{
        accountId: { type: String, required: true }, // From marketplace accounts settings
        accountName: { type: String, required: true },
        enabled: { type: Boolean, default: true },
        // Credentials can be at account level or use global settings
        appId: { type: String, default: null },
        appSecret: { type: String, default: null },
        locationId: { type: String, default: null },
        lastSyncedAt: { type: Date, default: null },
        lastSyncStatus: { 
          type: String, 
          enum: ['success', 'failed', 'pending', null],
          default: null 
        },
        lastSyncError: { type: String, default: null },
        // Variant-specific FSNs for this account
        variantMappings: [{
          color: String,
          size: String,
          fsn: String,
          flipkartSKU: String
        }]
      }],
      // ✅ DEPRECATED: Keep for backward compatibility, but use accountMappings instead
      isListed: { type: Boolean, default: false },
      fsn: { type: String, default: null },
      listingId: { type: String, default: null },
      locationId: { type: String, default: null },
      lastSyncedAt: { type: Date, default: null },
      lastSyncStatus: { 
        type: String, 
        enum: ['success', 'failed', 'pending', null],
        default: null 
      },
      lastSyncError: { type: String, default: null },
      variantMappings: [{
        color: String,
        size: String,
        flipkartSKU: String,
        fsn: String
      }]
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Compound unique index for multi-tenancy
productSchema.index({ design: 1, organizationId: 1 }, { unique: true });

// ✅ UPDATED: Initialize with enabled sizes from settings
productSchema.pre('save', async function(next) {
  try {
    // Only auto-initialize if sizes array is empty for a color
    for (const color of this.colors) {
      if (color.sizes.length === 0) {
        // Fetch enabled sizes from settings
        const Settings = mongoose.model('Settings');
        const settings = await Settings.findOne({ organizationId: this.organizationId });
        
        if (settings && settings.sizes) {
          // Use new sizes structure
          const enabledSizes = settings.sizes
            .filter(s => s.isEnabled)
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map(s => s.name);
          
          color.sizes = enabledSizes.map(size => ({
            size: size,
            currentStock: 0,
            lockedStock: 0,
            reorderPoint: 20,
            reservedAllocations: []
          }));
        } else if (settings && settings.enabledSizes) {
          // Fallback to old structure for backward compatibility
          color.sizes = settings.enabledSizes.map(size => ({
            size: size,
            currentStock: 0,
            lockedStock: 0,
            reorderPoint: 20,
            reservedAllocations: []
          }));
        } else {
          // Default sizes if no settings found
          color.sizes = ['S', 'M', 'L', 'XL', 'XXL'].map(size => ({
            size: size,
            currentStock: 0,
            lockedStock: 0,
            reorderPoint: 20,
            reservedAllocations: []
          }));
        }
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Product', productSchema);
