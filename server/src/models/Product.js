const mongoose = require('mongoose');

const sizeStockSchema = new mongoose.Schema({
  size: {
    type: String,
    enum: ['S', 'M', 'L', 'XL', 'XXL'],
    required: true,
  },
  currentStock: {
    type: Number,
    default: 0,
    min: 0,
  },
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
    // ✅ REMOVED: enum restriction - now accepts any color from palette
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

const productSchema = new mongoose.Schema({
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
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

// Compound unique index for multi-tenancy
productSchema.index({ design: 1, organizationId: 1 }, { unique: true });

// Initialize with all sizes when creating a new color
productSchema.pre('save', function(next) {
  this.colors.forEach(color => {
    if (color.sizes.length === 0) {
      color.sizes = [
        { size: 'S', currentStock: 0, lockedStock: 0, reorderPoint: 20 },
        { size: 'M', currentStock: 0, lockedStock: 0, reorderPoint: 20 },
        { size: 'L', currentStock: 0, lockedStock: 0, reorderPoint: 20 },
        { size: 'XL', currentStock: 0, lockedStock: 0, reorderPoint: 20 },
        { size: 'XXL', currentStock: 0, lockedStock: 0, reorderPoint: 20 },
      ];
    }
  });
  next();
});

module.exports = mongoose.model('Product', productSchema);
