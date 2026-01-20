const mongoose = require('mongoose');

// Payment history schema
const paymentHistorySchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true
  },
  paymentDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card', 'Other'],
    default: 'Cash'
  },
  notes: String,
  recordedBy: String,
  recordedByRole: String
});

// Challan item schema
const challanItemSchema = new mongoose.Schema({
  color: String,
  size: String,
  quantity: Number,
  price: Number,
  amount: Number
});

// Challan schema
const challanSchema = new mongoose.Schema({
  challanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WholesaleOrder'
  },
  challanNumber: String,
  challanDate: Date,
  items: [challanItemSchema],
  itemsQty: Number,
  taxableAmount: Number,
  gstAmount: Number,
  totalAmount: Number
});

// Monthly Bill Schema
const monthlyBillSchema = new mongoose.Schema({
  billNumber: {
    type: String,
    required: true,
  },
  financialYear: String,
  
  // Company details (seller)
  company: {
    id: String,
    name: String,
    legalName: String,
    gstin: String,
    pan: String,
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
      stateCode: String
    },
    contact: {
      phone: String,
      email: String
    },
    bank: {
      name: String,
      accountNo: String,
      ifsc: String,
      branch: String
    },
    logo: String
  },
  
  // Buyer details (UPDATED to support GST profiles)
  buyer: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WholesaleBuyer',
      required: true
    },
    name: String,
    mobile: String,
    email: String,
    businessName: String,  // Can be different per bill (from GST profile)
    gstin: String,         // Can be different per bill (from GST profile)
    pan: String,           // Can be different per bill (from GST profile)
    address: String,       // Can be different per bill (from GST profile)
    stateCode: String,     // Can be different per bill (from GST profile)
    
    // NEW: Track which GST profile was used
    gstProfileId: String   // Links to buyer.gstProfiles[].profileId
  },
  
  // Billing period
  billingPeriod: {
    month: {
      type: String,
      required: true
    },
    year: {
      type: Number,
      required: true
    },
    startDate: Date,
    endDate: Date
  },
  
  // Challans included in this bill
  challans: [challanSchema],
  
  // Financial details
  financials: {
    totalTaxableAmount: {
      type: Number,
      required: true,
      default: 0
    },
    cgst: {
      type: Number,
      default: 0
    },
    sgst: {
      type: Number,
      default: 0
    },
    igst: {
      type: Number,
      default: 0
    },
    gstRate: {
      type: Number,
      default: 5
    },
    invoiceTotal: {
      type: Number,
      required: true
    },
    previousOutstanding: {
      type: Number,
      default: 0
    },
    grandTotal: {
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
    }
  },
  
  // Bill status
  status: {
    type: String,
    enum: ['draft', 'generated', 'sent', 'partial', 'paid', 'overdue'],
    default: 'draft'
  },
  
  // Payment tracking
  paymentHistory: [paymentHistorySchema],
  paymentDueDate: Date,
  paidAt: Date,
  
  // HSN code for products
  hsnCode: {
    type: String,
    default: '6203'
  },
  
  // Dates
  generatedAt: Date,
  finalizedAt: Date,
  
  // NEW: Split bill tracking
  splitBillInfo: {
    isParent: {
      type: Boolean,
      default: false
    },
    isChild: {
      type: Boolean,
      default: false
    },
    parentBillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MonthlyBill'
    },
    childBillIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MonthlyBill'
    }],
    splitGroupId: String,       // Same for all bills in a split group
    targetAmount: Number,        // User-requested amount for this bill
    actualAmount: Number         // Actual bill amount after product assignment
  },
  
  // Organization
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
monthlyBillSchema.index({ billNumber: 1, organizationId: 1 }, { unique: true });
monthlyBillSchema.index({ organizationId: 1, 'buyer.id': 1 });
monthlyBillSchema.index({ organizationId: 1, status: 1 });
monthlyBillSchema.index({ organizationId: 1, 'billingPeriod.year': -1, 'billingPeriod.month': -1 });
monthlyBillSchema.index({ 'splitBillInfo.parentBillId': 1 });
monthlyBillSchema.index({ 'splitBillInfo.splitGroupId': 1 });

module.exports = mongoose.model('MonthlyBill', monthlyBillSchema);
