const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true,
  },
  mobile: {
    type: String,
    required: [true, 'Mobile number is required'],
    // ✅ REMOVED: unique: true (will use compound index instead)
    match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit mobile number'],
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
  },
  address: {
    type: String,
    trim: true,
  },
  totalPurchases: {
    type: Number,
    default: 0,
  },
  totalSpent: {
    type: Number,
    default: 0,
  },
  lastPurchaseDate: {
    type: Date,
  },
  firstPurchaseDate: {
    type: Date,
    default: Date.now,
  },
  notes: {
    type: String,
    trim: true,
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true, // ✅ CHANGED: Made required
  },
}, {
  timestamps: true,
});

// ✅ FIXED: Compound unique index (mobile + organizationId)
customerSchema.index({ mobile: 1, organizationId: 1 }, { unique: true });
customerSchema.index({ organizationId: 1, lastPurchaseDate: -1 });

module.exports = mongoose.model('Customer', customerSchema);
