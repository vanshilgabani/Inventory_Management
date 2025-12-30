const mongoose = require('mongoose');

const contactHistorySchema = new mongoose.Schema({
  date: {
    type: Date,
    default: Date.now
  },
  method: {
    type: String,
    enum: ['email', 'note'],
    required: true
  },
  details: String,
  sentBy: String,
  emailStatus: {
    type: String,
    enum: ['delivered', 'failed', 'pending'],
    default: 'pending'
  }
});

const paymentPromiseSchema = new mongoose.Schema({
  amount: Number,
  promisedDate: Date,
  notes: String,
  remindIfNotPaid: {
    type: Boolean,
    default: false
  }
});

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['overdue_payment', 'credit_limit_80', 'credit_exceeded', 'large_amount'],
    required: true
  },
  severity: {
    type: String,
    enum: ['warning', 'moderate', 'urgent', 'critical'],
    required: true
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WholesaleBuyer',
    required: true
  },
  orderIds: [{  // CHANGED: Array of order IDs instead of single orderId
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WholesaleOrder'
  }],
  pendingOrdersCount: {  // NEW: Count of pending orders
    type: Number,
    default: 0
  },
  creditUsagePercent: {  // NEW: For credit limit notifications
    type: Number
  },
  buyerName: String,
  businessName: String,
  buyerContact: String,
  buyerEmail: String,
  amountDue: Number,  // Total amount due across all orders
  daysOverdue: Number,  // Days since oldest order
  isTrusted: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'dismissed', 'resolved', 'snoozed'],
    default: 'active'
  },
  snoozedUntil: Date,
  paymentPromise: paymentPromiseSchema,
  contactHistory: [contactHistorySchema],
  dismissedAt: Date,
  resolvedAt: Date,
  autoEmailSent: {
    type: Boolean,
    default: false
  },
  autoEmailSentAt: Date
}, {
  timestamps: true
});

// Index for faster queries
notificationSchema.index({ status: 1, severity: 1, createdAt: -1 });
notificationSchema.index({ buyerId: 1 });
notificationSchema.index({ orderIds: 1 });  // CHANGED: Index on orderIds array

// Prevent duplicate notifications for same buyer + type combination
notificationSchema.index(
  { buyerId: 1, type: 1, status: 1 }, 
  { 
    unique: true,
    partialFilterExpression: { 
      status: { $in: ['active', 'snoozed'] } 
    }
  }
);

module.exports = mongoose.model('Notification', notificationSchema);
