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
  
  // Payment details
  planType: {
    type: String,
    enum: ['monthly', 'yearly', 'order-based'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  
  // Payment method
  paymentMethod: {
    type: String,
    enum: ['upi', 'cash'],
    required: true
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  
  // User information at time of request
  userDetails: {
    name: String,
    email: String,
    phone: String,
    businessName: String
  },
  
  // Admin actions
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  rejectionReason: String,
  
  // Razorpay order attempt (optional)
  razorpayOrderId: String,
  
}, { timestamps: true });

manualPaymentRequestSchema.index({ userId: 1, status: 1 });
manualPaymentRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ManualPaymentRequest', manualPaymentRequestSchema);
