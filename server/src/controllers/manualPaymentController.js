const ManualPaymentRequest = require('../models/ManualPaymentRequest');
const WholesaleBuyer = require('../models/WholesaleBuyer');
const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { PRICING, getPlanPrice, calculateProration } = require('../utils/pricingUtils');

// ==================== CREATE MANUAL PAYMENT REQUEST ====================
exports.createManualPaymentRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { planType, paymentMethod, amount, razorpayOrderId } = req.body;

    if (!['monthly', 'yearly', 'order-based'].includes(planType)) {
      return res.status(400).json({ success: false, message: 'Invalid plan type' });
    }
    if (!['upi', 'cash'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: 'Invalid payment method' });
    }

    const existingRequest = await ManualPaymentRequest.findOne({ userId, status: 'pending' });
    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending payment request. Please wait for admin approval.'
      });
    }

    // ✅ Issue 6 fix: server-side amount validation
    const subscription = await Subscription.findOne({ userId });
    const proration = subscription ? calculateProration(subscription, planType) : null;
    const expectedAmount = proration
      ? Math.round((proration.fullAmount - proration.credited) * 100) / 100
      : getPlanPrice(planType);

    const submittedAmount = parseFloat(amount);
    const tolerance = 2; // ₹2 tolerance for rounding
    if (isNaN(submittedAmount) || submittedAmount < 1) {
      return res.status(400).json({ success: false, message: 'Invalid payment amount' });
    }
    if (Math.abs(submittedAmount - expectedAmount) > tolerance) {
      return res.status(400).json({
        success: false,
        message: `Amount mismatch. Expected ₹${expectedAmount.toFixed(2)} but received ₹${submittedAmount.toFixed(2)}. Please use the amount shown on the subscription page.`,
        data: { expectedAmount, submittedAmount }
      });
    }

    const user = await User.findById(userId);

    const paymentRequest = await ManualPaymentRequest.create({
      userId,
      organizationId: req.user.organizationId || userId,
      planType,
      amount: submittedAmount,
      expectedAmount, // ✅ Store for admin cross-check
      creditApplied: proration?.credited || 0,
      paymentMethod,
      razorpayOrderId,
      userDetails: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        businessName: user.businessName || user.companyName
      }
    });

    logger.info('Manual payment request created', { userId, planType, paymentMethod, requestId: paymentRequest._id });

    res.status(201).json({
      success: true,
      message: 'Payment request submitted successfully! Admin will review it shortly.',
      data: { paymentRequest }
    });

  } catch (error) {
    logger.error('Create manual payment request failed', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to create payment request', error: error.message });
  }
};

// ==================== GET MY PAYMENT REQUESTS ====================
exports.getMyPaymentRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const requests = await ManualPaymentRequest.find({ userId }).sort({ createdAt: -1 }).limit(10);
    res.json({ success: true, data: { requests } });
  } catch (error) {
    logger.error('Get payment requests failed', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch payment requests', error: error.message });
  }
};

// ==================== ADMIN: GET ALL PAYMENT REQUESTS ====================
exports.getAllPaymentRequests = async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    const requests = await ManualPaymentRequest.find({ status })
      .populate('userId', 'name email phone businessName companyName linkedSupplier')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, data: { requests } });
  } catch (error) {
    logger.error('Get all payment requests failed', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch payment requests', error: error.message });
  }
};

// ==================== ADMIN: APPROVE PAYMENT REQUEST ====================
exports.approvePaymentRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { requestId } = req.params;
    const adminId = req.user.id;

    const paymentRequest = await ManualPaymentRequest.findById(requestId).session(session);
    if (!paymentRequest) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Payment request not found' });
    }
    if (paymentRequest.status !== 'pending') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Payment request already processed' });
    }

    const { userId, planType, amount, paymentMethod, invoiceId } = paymentRequest;

    // ✅ Handle invoice payment approval (grace period invoice)
    if (invoiceId) {
      const invoice = await Invoice.findById(invoiceId).session(session);
      if (!invoice) {
        await session.abortTransaction();
        return res.status(404).json({ success: false, message: 'Invoice not found' });
      }

      invoice.status = 'paid';
      invoice.paidAt = new Date();
      invoice.paymentMethod = paymentMethod === 'upi' ? 'UPI (Manual)' : 'Cash';
      invoice.paymentTransactionId = `MANUAL-${requestId}`;
      invoice.notes = `Payment approved by admin via ${paymentMethod}`;
      await invoice.save({ session });

      const subscription = await Subscription.findOne({ userId }).session(session);
      if (subscription && subscription.status === 'grace-period') {
        if (subscription.gracePeriodInvoiceId?.toString() === invoiceId.toString()) {
          subscription.status = 'active';
          subscription.gracePeriodEndDate = null;
          subscription.gracePeriodInvoiceId = null;

          // ✅ Issue 7 fix: restart billing from invoice billing period end + 1 day
          // NOT from next month start
          const now = new Date();
          let newCycleStart;
          if (invoice.billingPeriod?.endDate) {
            newCycleStart = new Date(invoice.billingPeriod.endDate);
            newCycleStart.setDate(newCycleStart.getDate() + 1);
            newCycleStart.setHours(0, 0, 0, 0);
          } else {
            // Fallback: start from beginning of current month
            newCycleStart = new Date(now.getFullYear(), now.getMonth(), 1);
          }
          const newCycleEnd = new Date(newCycleStart.getFullYear(), newCycleStart.getMonth() + 1, 0, 23, 59, 59);

          subscription.currentBillingCycle = {
            startDate: newCycleStart,
            endDate: newCycleEnd,
            invoiceGenerated: false,
            ordersCount: 0,
            totalAmount: 0
          };
          await subscription.save({ session });
        }
      }

      paymentRequest.status = 'approved';
      paymentRequest.reviewedBy = adminId;
      paymentRequest.reviewedAt = new Date();
      await paymentRequest.save({ session });
      await session.commitTransaction();

      logger.info('Invoice payment approved', { requestId, userId, invoiceId, amount, adminId });
      return res.json({
        success: true,
        message: 'Payment approved! Invoice marked as paid.',
        data: { invoice, subscription: subscription || null }
      });
    }

    // ==================== Subscription plan payment approval ====================
    const subscription = await Subscription.findOne({ userId }).session(session);
    if (!subscription) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    const user = await User.findById(userId).session(session);
    const now = new Date();

    const generateInvoiceNumber = async () => {
      const userShortId = userId.toString().slice(-6).toUpperCase();
      const year = now.getFullYear();
      const count = await Invoice.countDocuments({ userId }).session(session);
      return `INV-${year}-${userShortId}-${String(count + 1).padStart(3, '0')}`;
    };

    const invoiceNumber = await generateInvoiceNumber();

    // ✅ Use shared proration to determine correct dates and credit
    const proration = calculateProration(subscription, planType);

    if (planType === 'yearly') {
      let startDate, endDate;

      // ✅ Issue 3 fix: extend from existing expiry if plan is active + same plan
      if (proration.isRenewal && proration.currentExpiryDate) {
        startDate = subscription.yearlyStartDate;
        endDate = proration.newExpiryDate;
      } else if (proration.isRenewal && proration.newStartDate) {
        startDate = proration.newStartDate;
        endDate = proration.newExpiryDate;
      } else if (subscription.planType === 'monthly' && proration.newExpiryDate) {
        // monthly → yearly upgrade with credit applied
        startDate = now;
        endDate = proration.newExpiryDate;
      } else {
        startDate = now;
        endDate = new Date(now);
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      subscription.planType = 'yearly';
      subscription.status = 'active';
      subscription.yearlyStartDate = startDate;
      subscription.yearlyEndDate = endDate;
      subscription.yearlyPrice = PRICING.yearly;
      subscription.lastPaymentDate = now;
      subscription.nextPaymentDue = endDate;
      // ✅ Issue 4 fix: clear all stale plan data
      subscription.monthlyStartDate = undefined;
      subscription.monthlyEndDate = undefined;
      subscription.monthlyPrice = undefined;
      subscription.orderBasedStartDate = undefined;
      subscription.currentBillingCycle = undefined;
      subscription.ordersUsedThisMonth = undefined;
      subscription.ordersUsedTotal = undefined;
      subscription.gracePeriodEndDate = undefined;
      subscription.gracePeriodInvoiceId = undefined;
      subscription.notificationsSent = {};
      await subscription.save({ session });

      // ✅ Issue 2 fix: record credit in invoice items
      const invoiceItems = [{
        description: 'Annual Subscription - Inventory & Marketplace Management System',
        quantity: 1,
        unitPrice: PRICING.yearly,
        amount: PRICING.yearly
      }];
      if (proration.credited > 0) {
        invoiceItems.push({
          description: `Credit from monthly plan (${proration.daysRemaining} days remaining)`,
          quantity: 1,
          unitPrice: -proration.credited,
          amount: -proration.credited
        });
      }
      const actualAmountPaid = proration.fullAmount - proration.credited;

      await Invoice.create([{
        userId,
        organizationId: paymentRequest.organizationId,
        invoiceNumber,
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: user.phone,
        invoiceType: 'yearly-subscription',
        planType: 'yearly',
        items: invoiceItems,
        subtotal: PRICING.yearly,
        discount: proration.credited,
        gstRate: 0, cgst: 0, sgst: 0, igst: 0,
        totalAmount: actualAmountPaid,
        status: 'paid',
        paidAt: now,
        paymentMethod: paymentMethod === 'upi' ? 'UPI (Manual)' : 'Cash',
        paymentTransactionId: `MANUAL-${requestId}`,
        paymentDueDate: now,
        generatedAt: now,
        sentAt: now,
        notes: proration.credited > 0
          ? `Credit of ₹${proration.credited.toFixed(2)} applied from monthly plan. Approved by admin.`
          : 'Payment approved by admin.'
      }], { session });

    } else if (planType === 'monthly') {
      let startDate, endDate;

      // ✅ Issue 3 fix: extend from existing monthlyEndDate if active
      if (proration.isRenewal && proration.currentExpiryDate) {
        startDate = subscription.monthlyStartDate;
        endDate = proration.newExpiryDate;
      } else if (proration.isRenewal && proration.newStartDate) {
        startDate = proration.newStartDate;
        endDate = proration.newExpiryDate;
      } else {
        startDate = now;
        endDate = new Date(now);
        endDate.setMonth(endDate.getMonth() + 1);
      }

      subscription.planType = 'monthly';
      subscription.status = 'active';
      subscription.monthlyStartDate = startDate;
      subscription.monthlyEndDate = endDate;
      subscription.monthlyPrice = PRICING.monthly;
      subscription.lastPaymentDate = now;
      subscription.nextPaymentDue = endDate;
      // ✅ Issue 4 fix: clear all stale plan data
      subscription.yearlyStartDate = undefined;
      subscription.yearlyEndDate = undefined;
      subscription.yearlyPrice = undefined;
      subscription.orderBasedStartDate = undefined;
      subscription.currentBillingCycle = undefined;
      subscription.ordersUsedThisMonth = undefined;
      subscription.ordersUsedTotal = undefined;
      subscription.gracePeriodEndDate = undefined;
      subscription.gracePeriodInvoiceId = undefined;
      subscription.notificationsSent = {};
      await subscription.save({ session });

      await Invoice.create([{
        userId,
        organizationId: paymentRequest.organizationId,
        invoiceNumber,
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: user.phone,
        invoiceType: 'monthly-subscription',
        planType: 'monthly',
        items: [{ description: 'Monthly Subscription - Inventory & Marketplace Management System', quantity: 1, unitPrice: PRICING.monthly, amount: PRICING.monthly }],
        subtotal: PRICING.monthly,
        gstRate: 0, cgst: 0, sgst: 0, igst: 0,
        totalAmount: amount,
        status: 'paid',
        paidAt: now,
        paymentMethod: paymentMethod === 'upi' ? 'UPI (Manual)' : 'Cash',
        paymentTransactionId: `MANUAL-${requestId}`,
        paymentDueDate: now,
        generatedAt: now,
        sentAt: now
      }], { session });

    } else if (planType === 'order-based') {
      const startDate = now;
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

      subscription.planType = 'order-based';
      subscription.status = 'active';
      subscription.orderBasedStartDate = startDate;
      subscription.pricePerOrder = Number(process.env.PRICE_PER_ORDER) || 0.5;
      subscription.ordersUsedThisMonth = 0;
      subscription.ordersUsedTotal = 0;
      subscription.currentBillingCycle = { startDate, endDate, ordersCount: 0, totalAmount: 0, invoiceGenerated: false };
      subscription.notificationsSent = {};
      await subscription.save({ session });
    }

    paymentRequest.status = 'approved';
    paymentRequest.reviewedBy = adminId;
    paymentRequest.reviewedAt = now;
    await paymentRequest.save({ session });
    await session.commitTransaction();

    logger.info('Manual payment approved', { requestId, userId, planType, adminId, invoiceNumber });

    res.json({
      success: true,
      message: `Payment approved! ${planType === 'order-based' ? 'Order-based plan' : planType.charAt(0).toUpperCase() + planType.slice(1) + ' subscription'} activated.`,
      data: { paymentRequest, subscription }
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Approve payment failed', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to approve payment', error: error.message });
  } finally {
    session.endSession();
  }
};

// Admin: Reject payment request
exports.rejectPaymentRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    const paymentRequest = await ManualPaymentRequest.findById(requestId);

    if (!paymentRequest) {
      return res.status(404).json({
        success: false,
        message: 'Payment request not found'
      });
    }

    if (paymentRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Payment request already processed'
      });
    }

    paymentRequest.status = 'rejected';
    paymentRequest.reviewedBy = adminId;
    paymentRequest.reviewedAt = new Date();
    paymentRequest.rejectionReason = reason || 'Payment not verified';
    await paymentRequest.save();

    logger.info('Manual payment rejected', {
      requestId,
      userId: paymentRequest.userId,
      adminId,
      reason
    });

    res.json({
      success: true,
      message: 'Payment request rejected',
      data: { paymentRequest }
    });

  } catch (error) {
    logger.error('Reject payment failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to reject payment',
      error: error.message
    });
  }
};

// Get payment requests from independent users (no linked supplier) → Developer only
exports.getIndependentUserPaymentRequests = async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    const DEVELOPER_ID = '69baa77ed43ec29b9968354b';

    const requests = await ManualPaymentRequest.find({ status })
      .populate('userId', 'name email phone businessName organizationId linkedSupplier')
      .sort({ createdAt: -1 })
      .limit(100);

    const independentRequests = requests.filter(req => {
      const supplier = req.userId?.linkedSupplier;
      const isDevAccount = req.userId?._id?.toString() === DEVELOPER_ID;

      // ✅ Exclude developer's own requests + only show users with no real supplier
      return !isDevAccount && !supplier?.supplierUserId;
    });

    res.json({
      success: true,
      data: { requests: independentRequests }
    });

  } catch (error) {
    logger.error('Get independent user payment requests failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment requests',
      error: error.message
    });
  }
};

module.exports = exports;
