// models/Invoice.js

const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  // Invoice identification
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },

  // Customer details
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customerName: String,
  customerEmail: String,
  customerPhone: String,
  customerGSTIN: String,

  // Billing period (for order-based plans)
  billingPeriod: {
    startDate: Date,
    endDate: Date,
    month: String, // e.g., "January 2026"
  },

  // Invoice type
  invoiceType: {
    type: String,
    enum: ['yearly-subscription', 'monthly-subscription', 'order-based', 'addon'], // ✅ Added monthly-subscription
    required: true
  },

  // Plan details
  planType: {
    type: String,
    enum: ['yearly', 'monthly', 'order-based'] // ✅ Added monthly
  },

  // Line items
  items: [{
    description: String, // e.g., "Marketplace orders (120 orders × ₹8)"
    quantity: Number,
    unitPrice: Number,
    amount: Number
  }],

  // Financial details
  subtotal: { type: Number, required: true },
  gstRate: { type: Number, default: 18 }, // 18% GST
  cgst: Number,
  sgst: Number,
  igst: Number,
  totalAmount: { type: Number, required: true },

  // Payment details
  status: {
    type: String,
    enum: ['draft', 'generated', 'sent', 'paid', 'overdue', 'cancelled'],
    default: 'generated'
  },
  paymentDueDate: Date,
  paidAt: Date,
  paymentMethod: String, // 'Razorpay', 'UPI', 'Bank Transfer'
  paymentTransactionId: String,
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,

  // Invoice dates
  generatedAt: { type: Date, default: Date.now },
  sentAt: Date,

  // PDF
  pdfUrl: String,

  // Notes
  notes: String,

  // Organization
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

// Indexes
invoiceSchema.index({ userId: 1, createdAt: -1 });
invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ status: 1, paymentDueDate: 1 });
invoiceSchema.index({ organizationId: 1 });

// Generate invoice number
invoiceSchema.pre('save', async function(next) {
  if (!this.invoiceNumber) {
    const count = await mongoose.model('Invoice').countDocuments();
    const year = new Date().getFullYear();
    this.invoiceNumber = `INV-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);
