const mongoose = require('mongoose');

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

// ✅ Monthly bill tracking (synced from MonthlyBill)
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

// Old bulk payment schema (keep for backward compatibility)
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

const wholesaleBuyerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  mobile: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    lowercase: true,
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  address: String,
  businessName: String,
  gstNumber: String,
  pan: String,
  stateCode: String,
  creditLimit: {
    type: Number,
    default: 0,
  },
  creditLimitHistory: [creditLimitHistorySchema],
  isTrusted: {
    type: Boolean,
    default: false
  },
  trustUpdatedBy: String,
  trustUpdatedAt: Date,
  
  // ✅ NEW: Monthly bill system
  monthlyBills: [monthlyBillTrackingSchema],
  
  // Legacy fields
  totalOrders: {
    type: Number,
    default: 0,
  },
  totalSpent: {
    type: Number,
    default: 0,
  },
  totalDue: {
    type: Number,
    default: 0,
  },
  totalPaid: {
    type: Number,
    default: 0,
  },
  lastOrderDate: {
    type: Date,
    default: null
  },
  
  // Old bulk payments (keep for backward compatibility)
  bulkPayments: [bulkPaymentSchema],
  
  challanCounter: {
    type: Number,
    default: 0
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

// Indexes
wholesaleBuyerSchema.index({ mobile: 1, organizationId: 1 }, { unique: true });
wholesaleBuyerSchema.index({ organizationId: 1, totalDue: -1 });
wholesaleBuyerSchema.index({ organizationId: 1, lastOrderDate: -1 });
wholesaleBuyerSchema.index({ organizationId: 1, 'monthlyBills.year': -1, 'monthlyBills.month': -1 });

module.exports = mongoose.model('WholesaleBuyer', wholesaleBuyerSchema);
