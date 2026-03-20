const ManualPaymentRequest = require('../models/ManualPaymentRequest');
const WholesaleBuyer = require('../models/WholesaleBuyer');
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
    const adminId = req.user.id;

    // Step 1: Find all customers linked to this admin via WholesaleBuyer
    const linkedBuyers = await WholesaleBuyer.find({
      organizationId: adminId,
      customerUserId: { $ne: null }
    }).select('customerUserId').lean();

    const customerIds = linkedBuyers.map(b => b.customerUserId);

    // Step 2: Return only requests from those customers
    const requests = await ManualPaymentRequest.find({
      status,
      userId: { $in: customerIds }
    })
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
}

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

    const { userId, planType, amount, paymentMethod, invoiceId } = paymentRequest;

    // 🆕 Handle invoice payment approval
    if (invoiceId) {
      const invoice = await Invoice.findById(invoiceId).session(session);

      if (!invoice) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
      }

      // ✅ Update invoice to paid
      invoice.status = 'paid';
      invoice.paidAt = new Date();
      invoice.paymentMethod = paymentMethod === 'upi' ? 'UPI (Manual)' : 'Cash';
      invoice.paymentTransactionId = `MANUAL-${requestId}`;
      invoice.notes = `Payment approved by admin via ${paymentMethod}`;
      await invoice.save({ session });

      // ✅ If this was a grace period invoice, reactivate subscription
      const subscription = await Subscription.findOne({ userId }).session(session);

      if (subscription && subscription.status === 'grace-period') {
        if (subscription.gracePeriodInvoiceId?.toString() === invoiceId.toString()) {
          subscription.status = 'active';
          subscription.gracePeriodEndDate = null;
          subscription.gracePeriodInvoiceId = null;
          
          // Reset billing cycle for next month
          const now = new Date();
          const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          subscription.currentBillingCycle = {
            startDate: nextMonthStart,
            endDate: new Date(nextMonthStart.getFullYear(), nextMonthStart.getMonth() + 1, 0),
            invoiceGenerated: false,
            ordersCount: 0,
            totalAmount: 0
          };
          
          await subscription.save({ session });
        }
      }

      // Update payment request
      paymentRequest.status = 'approved';
      paymentRequest.reviewedBy = adminId;
      paymentRequest.reviewedAt = new Date();
      await paymentRequest.save({ session });

      await session.commitTransaction();

      logger.info('Invoice payment approved', {
        requestId,
        userId,
        invoiceId,
        amount,
        adminId,
        invoiceNumber: invoice.invoiceNumber
      });

      return res.json({
        success: true,
        message: 'Payment approved! Invoice marked as paid.',
        data: {
          invoice,
          subscription: subscription || null
        }
      });
    }

    // 🔽 Handle subscription payment approval (existing logic)
    const subscription = await Subscription.findOne({ userId }).session(session);

    if (!subscription) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    const user = await User.findById(userId).session(session);

    // ✅ Generate invoice number
    const generateInvoiceNumber = async () => {
      const userShortId = userId.toString().slice(-6).toUpperCase();
      const year = new Date().getFullYear();
      const count = await Invoice.countDocuments({ userId }).session(session);
      return `INV-${year}-${userShortId}-${String(count + 1).padStart(3, '0')}`;
    };

    const invoiceNumber = await generateInvoiceNumber();
    const now = new Date();

    if (planType === 'yearly') {
      const startDate = now;
      const endDate = new Date(now);
      endDate.setFullYear(endDate.getFullYear() + 1);

      subscription.planType = 'yearly';
      subscription.status = 'active';
      subscription.yearlyStartDate = startDate;
      subscription.yearlyEndDate = endDate;
      subscription.yearlyPrice = amount;
      subscription.lastPaymentDate = now;
      subscription.nextPaymentDue = endDate;
      subscription.notificationsSent = {};

      await subscription.save({ session });

      await Invoice.create([{
        userId,
        organizationId: paymentRequest.organizationId,
        invoiceNumber,
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
        paidAt: now,
        paymentMethod: paymentMethod === 'upi' ? 'UPI (Manual)' : 'Cash',
        paymentTransactionId: `MANUAL-${requestId}`,
        paymentDueDate: now,
        generatedAt: now,
        sentAt: now
      }], { session });

    } else if (planType === 'monthly') {
      const startDate = now;
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 1);

      subscription.planType = 'monthly';
      subscription.status = 'active';
      subscription.monthlyStartDate = startDate;
      subscription.monthlyEndDate = endDate;
      subscription.monthlyPrice = amount;
      subscription.lastPaymentDate = now;
      subscription.nextPaymentDue = endDate;
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
    paymentRequest.reviewedAt = now;
    await paymentRequest.save({ session });

    await session.commitTransaction();

    logger.info('Manual payment approved', {
      requestId,
      userId,
      planType,
      adminId,
      invoiceNumber
    });

    res.json({
      success: true,
      message: `Payment approved! ${planType === 'order-based' ? 'Order-based plan' : planType.charAt(0).toUpperCase() + planType.slice(1) + ' subscription'} activated.`,
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
