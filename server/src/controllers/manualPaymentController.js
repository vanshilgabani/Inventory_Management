const ManualPaymentRequest = require('../models/ManualPaymentRequest');
const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Create manual payment request
exports.createManualPaymentRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { planType, paymentMethod, amount, razorpayOrderId } = req.body;

    if (!['monthly', 'yearly', 'order-based'].includes(planType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan type'
      });
    }

    if (!['upi', 'cash'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method'
      });
    }

    // Check if there's already a pending request
    const existingRequest = await ManualPaymentRequest.findOne({
      userId,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending payment request. Please wait for admin approval.'
      });
    }

    const user = await User.findById(userId);

    const paymentRequest = await ManualPaymentRequest.create({
      userId,
      organizationId: req.user.organizationId || userId,
      planType,
      amount,
      paymentMethod,
      razorpayOrderId,
      userDetails: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        businessName: user.businessName || user.companyName
      }
    });

    logger.info('Manual payment request created', {
      userId,
      planType,
      paymentMethod,
      requestId: paymentRequest._id
    });

    res.status(201).json({
      success: true,
      message: 'Payment request submitted successfully! Admin will review it shortly.',
      data: { paymentRequest }
    });

  } catch (error) {
    logger.error('Create manual payment request failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create payment request',
      error: error.message
    });
  }
};

// Get user's payment requests
exports.getMyPaymentRequests = async (req, res) => {
  try {
    const userId = req.user.id;

    const requests = await ManualPaymentRequest.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: { requests }
    });

  } catch (error) {
    logger.error('Get payment requests failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment requests',
      error: error.message
    });
  }
};

// Admin: Get all pending payment requests
exports.getAllPaymentRequests = async (req, res) => {
  try {
    const { status = 'pending' } = req.query;

    const requests = await ManualPaymentRequest.find({ status })
      .populate('userId', 'name email phone businessName companyName')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: { requests }
    });

  } catch (error) {
    logger.error('Get all payment requests failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment requests',
      error: error.message
    });
  }
};

// Admin: Approve payment request
exports.approvePaymentRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { requestId } = req.params;
    const adminId = req.user.id;

    const paymentRequest = await ManualPaymentRequest.findById(requestId).session(session);

    if (!paymentRequest) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Payment request not found'
      });
    }

    if (paymentRequest.status !== 'pending') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Payment request already processed'
      });
    }

    const { userId, planType, amount, paymentMethod } = paymentRequest;

    // Update subscription (same logic as Razorpay success)
    const subscription = await Subscription.findOne({ userId }).session(session);

    if (!subscription) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    const user = await User.findById(userId).session(session);

    if (planType === 'yearly') {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);

      subscription.planType = 'yearly';
      subscription.status = 'active';
      subscription.yearlyStartDate = startDate;
      subscription.yearlyEndDate = endDate;
      subscription.yearlyPrice = amount;
      subscription.lastPaymentDate = new Date();
      subscription.nextPaymentDue = endDate;
      subscription.notificationsSent = {};

      await subscription.save({ session });

      // Create invoice
      const invoice = await Invoice.create([{
        userId,
        organizationId: paymentRequest.organizationId,
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: user.phone,
        invoiceType: 'yearly-subscription',
        planType: 'yearly',
        items: [{
          description: 'Annual Subscription - Inventory & Marketplace Management System',
          quantity: 1,
          unitPrice: amount,
          amount: amount
        }],
        subtotal: amount,
        gstRate: 0,
        cgst: 0,
        sgst: 0,
        totalAmount: amount,
        status: 'paid',
        paidAt: new Date(),
        paymentMethod: paymentMethod === 'upi' ? 'UPI (Manual)' : 'Cash',
        paymentDueDate: new Date(),
        generatedAt: new Date(),
        sentAt: new Date()
      }], { session });

    } else if (planType === 'monthly') {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      subscription.planType = 'monthly';
      subscription.status = 'active';
      subscription.monthlyStartDate = startDate;
      subscription.monthlyEndDate = endDate;
      subscription.monthlyPrice = amount;
      subscription.lastPaymentDate = new Date();
      subscription.nextPaymentDue = endDate;
      subscription.notificationsSent = {};

      await subscription.save({ session });

      // Create invoice
      await Invoice.create([{
        userId,
        organizationId: paymentRequest.organizationId,
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: user.phone,
        invoiceType: 'monthly-subscription',
        planType: 'monthly',
        items: [{
          description: 'Monthly Subscription - Inventory & Marketplace Management System',
          quantity: 1,
          unitPrice: amount,
          amount: amount
        }],
        subtotal: amount,
        gstRate: 0,
        cgst: 0,
        sgst: 0,
        totalAmount: amount,
        status: 'paid',
        paidAt: new Date(),
        paymentMethod: paymentMethod === 'upi' ? 'UPI (Manual)' : 'Cash',
        paymentDueDate: new Date(),
        generatedAt: new Date(),
        sentAt: new Date()
      }], { session });

    } else if (planType === 'order-based') {
      const startDate = new Date();
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

      subscription.planType = 'order-based';
      subscription.status = 'active';
      subscription.orderBasedStartDate = startDate;
      subscription.pricePerOrder = Number(process.env.PRICE_PER_ORDER) || 0.5;
      subscription.ordersUsedThisMonth = 0;
      subscription.ordersUsedTotal = 0;
      subscription.currentBillingCycle = {
        startDate,
        endDate,
        ordersCount: 0,
        totalAmount: 0,
        invoiceGenerated: false
      };
      subscription.notificationsSent = {};

      await subscription.save({ session });
    }

    // Update payment request status
    paymentRequest.status = 'approved';
    paymentRequest.reviewedBy = adminId;
    paymentRequest.reviewedAt = new Date();
    await paymentRequest.save({ session });

    await session.commitTransaction();

    logger.info('Manual payment approved', {
      requestId,
      userId,
      planType,
      adminId
    });

    res.json({
      success: true,
      message: 'Payment approved and subscription activated!',
      data: { paymentRequest, subscription }
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Approve payment failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to approve payment',
      error: error.message
    });
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

module.exports = exports;
