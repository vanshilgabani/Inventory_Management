const mongoose = require('mongoose');

// ✅ NEW: Item schema for array of items
const saleItemSchema = new mongoose.Schema({
  design: {
    type: String,
    required: true,
  },
  color: {
    type: String,
    required: true,
  },
  size: {
    type: String,
    required: true,
    enum: ['S', 'M', 'L', 'XL', 'XXL'],
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  pricePerUnit: {
    type: Number,
    required: true,
    min: 0,
  },
  subtotal: {
    type: Number,
  },
});

const directSaleSchema = new mongoose.Schema({
  customerName: {
    type: String,
    default: 'Walk-in Customer',
  },
  customerMobile: {
    type: String,
    required: true,
  },
  customerEmail: {
    type: String,
  },
  customerAddress: {
    type: String,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
  },
  // ✅ NEW: Array of items instead of single item fields
  items: [saleItemSchema],
  subtotalAmount: {
    type: Number,
    default: 0,
  },
  discountAmount: {
    type: Number,
    default: 0,
  },
  gstAmount: {
    type: Number,
    default: 0,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Card', 'UPI', 'Bank Transfer'],
    default: 'Cash',
  },
  notes: {
    type: String,
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  saleDate: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// ✅ Calculate subtotals before saving
directSaleSchema.pre('validate', function(next) {
  // Calculate item subtotals
  if (this.items && this.items.length > 0) {
    this.items.forEach(item => {
      item.subtotal = item.quantity * item.pricePerUnit;
    });
  }
  next();
});

// ✅ Compound index for organization
directSaleSchema.index({ organizationId: 1, saleDate: -1 });
directSaleSchema.index({ customerId: 1, saleDate: -1 });

module.exports = mongoose.model('DirectSale', directSaleSchema);
