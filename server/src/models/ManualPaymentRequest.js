const mongoose = require('mongoose');

const manualPaymentRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  planType: {
    type: String,
    enum: ['monthly', 'yearly', 'order-based', 'invoice-payment'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },

  // ✅ Issue 6: Store server-calculated expected amount for admin cross-check
  expectedAmount: {
    type: Number,
    default: null
  },

  // ✅ Issue 2: Store credit applied (proration) so invoice reflects it
  creditApplied: {
    type: Number,
    default: 0
  },

  paymentMethod: {
    type: String,
    enum: ['upi', 'cash'],
    required: true
  },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },

  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  invoiceNumber: {
    type: String
  },

  userDetails: {
    name: String,
    email: String,
    phone: String,
    businessName: String
  },

  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  rejectionReason: String,

  razorpayOrderId: String,

}, { timestamps: true });

manualPaymentRequestSchema.index({ userId: 1, status: 1 });
manualPaymentRequestSchema.index({ status: 1, createdAt: -1 });
manualPaymentRequestSchema.index({ invoiceId: 1 });

module.exports = mongoose.model('ManualPaymentRequest', manualPaymentRequestSchema);