const mongoose = require('mongoose');

const challanItemSchema = new mongoose.Schema({
  challanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WholesaleOrder',
    required: true
  },
  challanNumber: {
    type: String,
    required: true
  },
  challanDate: {
    type: Date,
    required: true
  },
  itemsQty: {
    type: Number,
    required: true
  },
  taxableAmount: {
    type: Number,
    required: true
  },
  gstAmount: {
    type: Number,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  }
});

const paymentRecordSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true
  },
  paymentDate: {
    type: Date,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card', 'Other'],
    default: 'Cash'
  },
  notes: String,
  recordedBy: {
    type: String,
    required: true
  },
  recordedByRole: {
    type: String,
    enum: ['admin', 'sales'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const monthlyBillSchema = new mongoose.Schema({
  billNumber: {
    type: String,
    required: true,
    unique: true
  },
  
  // Financial Year
  financialYear: {
    type: String,
    required: true
  },
  
  // Company Details (snapshot at time of bill generation)
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
  
  // Buyer Details (snapshot)
  buyer: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WholesaleBuyer',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    mobile: {
      type: String,
      required: true
    },
    email: String,
    businessName: String,
    gstin: String,
    pan: String,
    address: String,
    stateCode: String
  },
  
  // Billing Period
  billingPeriod: {
    month: {
      type: String,
      required: true
    },
    year: {
      type: Number,
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    }
  },
  
  // Challans included in this bill
  challans: [challanItemSchema],
  
  // Financial Details
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
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'generated', 'sent', 'partial', 'paid', 'overdue'],
    default: 'draft'
  },
  
  // Payment tracking
  paymentDueDate: {
    type: Date,
    required: true
  },
  
  paymentHistory: [paymentRecordSchema],
  
  // Timestamps
  generatedAt: {
    type: Date,
    default: Date.now
  },
  
  finalizedAt: Date,
  
  sentAt: Date,
  
  paidAt: Date,
  
  // Additional info
  notes: String,
  
  hsnCode: {
    type: String,
    default: '6203'
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
monthlyBillSchema.index({ billNumber: 1 }, { unique: true });
monthlyBillSchema.index({ organizationId: 1, 'buyer.id': 1 });
monthlyBillSchema.index({ organizationId: 1, status: 1 });
monthlyBillSchema.index({ organizationId: 1, 'billingPeriod.year': 1, 'billingPeriod.month': 1 });

module.exports = mongoose.model('MonthlyBill', monthlyBillSchema);
