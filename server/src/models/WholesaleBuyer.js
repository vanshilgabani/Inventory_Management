const mongoose = require('mongoose');

// Credit limit history schema
const creditLimitHistorySchema = new mongoose.Schema({
  previousLimit: Number,
  newLimit: Number,
  updatedBy: String,
  updatedAt: {
    type: Date,
    default: Date.now
  },
  reason: String
});

// Monthly bill tracking synced from MonthlyBill
const monthlyBillTrackingSchema = new mongoose.Schema({
  billId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MonthlyBill',
    required: true
  },
  billNumber: {
    type: String,
    required: true
  },
  month: {
    type: String,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  invoiceTotal: {
    type: Number,
    required: true
  },
  amountPaid: {
    type: Number,
    default: 0
  },
  balanceDue: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'generated', 'sent', 'partial', 'paid', 'overdue'],
    required: true
  },
  generatedAt: {
    type: Date,
    required: true
  }
});

// Old bulk payment schema - keep for backward compatibility
const bulkPaymentSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card', 'Other'],
    default: 'Cash'
  },
  paymentDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  notes: {
    type: String,
    default: ''
  },
  recordedBy: {
    type: String,
    required: true
  },
  recordedByRole: {
    type: String,
    enum: ['admin', 'sales'],
    required: true
  },
  ordersAffected: [{
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WholesaleOrder'
    },
    challanNumber: String,
    amountAllocated: Number,
    previousDue: Number,
    newDue: Number
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// NEW: GST Profile Schema
const gstProfileSchema = new mongoose.Schema({
  profileId: {
    type: String,
    required: true
  },
  gstNumber: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  // Auto-fetched from GST API (read-only fields)
  businessName: {
    type: String,
    required: true
  },
  legalName: String,
  tradeName: String,
  pan: String,
  address: {
    building: String,
    street: String,
    location: String,
    district: String,
    state: String,
    pincode: String,
    fullAddress: String
  },
  stateCode: String,
  registrationDate: Date,
  gstStatus: {
    type: String,
    enum: ['Active', 'Cancelled', 'Suspended'],
    default: 'Active'
  },
  // User-controllable fields
  isDefault: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: String,
  // Metadata
  addedAt: {
    type: Date,
    default: Date.now
  },
  lastUsedAt: Date,
  usageCount: {
    type: Number,
    default: 0
  }
});

// Main WholesaleBuyer Schema
const wholesaleBuyerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  mobile: {
    type: String,
    required: true
  },
  email: {
    type: String,
    lowercase: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  address: String,
  
  // OLD fields - Keep for backward compatibility
  businessName: String,
  gstNumber: String,
  pan: String,
  stateCode: String,
  
  // NEW: Multiple GST profiles
  gstProfiles: [gstProfileSchema],
  
  // Credit management
  creditLimit: {
    type: Number,
    default: 0
  },
  creditLimitHistory: [creditLimitHistorySchema],
  isTrusted: {
    type: Boolean,
    default: false
  },
  trustUpdatedBy: String,
  trustUpdatedAt: Date,
  
  // Monthly bill system
  monthlyBills: [monthlyBillTrackingSchema],
  
  // Legacy fields
  totalOrders: {
    type: Number,
    default: 0
  },
  totalSpent: {
    type: Number,
    default: 0
  },
  totalDue: {
    type: Number,
    default: 0
  },
  totalPaid: {
    type: Number,
    default: 0
  },
  lastOrderDate: {
    type: Date,
    default: null
  },
  
  // Old bulk payments - keep for backward compatibility
  bulkPayments: [bulkPaymentSchema],
  
  challanCounter: {
    type: Number,
    default: 0
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
wholesaleBuyerSchema.index({ mobile: 1, organizationId: 1 }, { unique: true });
wholesaleBuyerSchema.index({ organizationId: 1, totalDue: -1 });
wholesaleBuyerSchema.index({ organizationId: 1, lastOrderDate: -1 });
wholesaleBuyerSchema.index({ organizationId: 1, 'monthlyBills.year': -1, 'monthlyBills.month': -1 });
wholesaleBuyerSchema.index({ organizationId: 1, 'gstProfiles.gstNumber': 1 });

module.exports = mongoose.model('WholesaleBuyer', wholesaleBuyerSchema);
