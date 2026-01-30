// models/Subscription.js

const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  // User reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  // Plan details
  planType: {
    type: String,
    enum: ['trial', 'monthly', 'yearly', 'order-based'],
    default: 'trial'
  },

  // Plan status
  status: {
    type: String,
    enum: ['trial', 'active', 'expired', 'cancelled', 'suspended', 'grace-period'],
    default: 'trial'
  },

  trialEndsAt: {
    type: Date,
    default: function() {
      const trialDays = parseInt(process.env.TRIAL_DAYS) || 7;
      return new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
    }
  },

  usageLimits: {
    monthlyOrderLimit: {
      type: Number,
      default: null // Null = unlimited
    },
    currentMonthOrders: {
      type: Number,
      default: 0
    },
    lastResetDate: {
      type: Date,
      default: Date.now
    }
  },

  // Trial details
  trialStartDate: Date,
  trialEndDate: Date,
  trialOrdersUsed: { type: Number, default: 0 },

  // ✅ Monthly plan details (NEW)
  monthlyStartDate: Date,
  monthlyEndDate: Date,
  monthlyPrice: { type: Number, default: 0 },

  // Yearly plan details
  yearlyStartDate: Date,
  yearlyEndDate: Date,
  yearlyPrice: { type: Number, default: 0 },

  // Order-based plan details
  orderBasedStartDate: Date,
  pricePerOrder: {
    type: Number,
    default: function() {
      return parseFloat(process.env.ORDER_BASED_PRICE) || 0.5;
    }
  },
  ordersUsedThisMonth: { type: Number, default: 0 },
  ordersUsedTotal: { type: Number, default: 0 },

  // Billing cycle for order-based
  currentBillingCycle: {
    startDate: Date,
    endDate: Date,
    ordersCount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    invoiceGenerated: { type: Boolean, default: false },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' }
  },

  // Grace period (7 days after expiry)
  gracePeriodEndDate: Date,

  // Auto-renewal
  autoRenew: { type: Boolean, default: false },

  // Payment tracking
  lastPaymentDate: Date,
  nextPaymentDue: Date,

  // Notifications sent
  notificationsSent: {
    trialEnding: { type: Boolean, default: false },
    trialEnded: { type: Boolean, default: false },
    expiringIn7Days: { type: Boolean, default: false },
    expiringIn3Days: { type: Boolean, default: false },
    expired: { type: Boolean, default: false },
    invoiceGenerated: { type: Boolean, default: false }
  },

  // Organization
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true, toJSON: { virtuals: true },   // ✅ ADD THIS
  toObject: { virtuals: true } });

// Indexes
subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ status: 1, yearlyEndDate: 1 });
subscriptionSchema.index({ organizationId: 1 });

// Virtual: Check if trial is active
subscriptionSchema.virtual('isTrialActive').get(function() {
  return this.status === 'trial' && new Date() <= this.trialEndDate;
});

// Virtual: Check if subscription is active
subscriptionSchema.virtual('isActive').get(function() {
  return ['trial', 'active', 'grace-period'].includes(this.status);
});

// Virtual: Days remaining in trial
subscriptionSchema.virtual('trialDaysRemaining').get(function() {
  if (this.status !== 'trial') return 0;
  const diff = this.trialEndDate - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

// Virtual - Get trial orders limit from .env (always fresh)
subscriptionSchema.virtual('trialOrdersLimit').get(function() {
  return parseInt(process.env.TRIAL_ORDERS_LIMIT || '5000');
});

// Virtual - Calculate remaining orders
subscriptionSchema.virtual('trialOrdersRemaining').get(function() {
  const limit = parseInt(process.env.TRIAL_ORDERS_LIMIT || '5000');
  return Math.max(0, limit - (this.trialOrdersUsed || 0));
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
