// controllers/subscriptionController.js
const Subscription = require('../models/Subscription');
const TenantSettings = require('../models/TenantSettings');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// ==================== TRIAL MANAGEMENT ====================

// Initialize trial subscription for new tenant
exports.initializeTrial = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;
    const organizationId = req.user.organizationId || userId;

    // Check if subscription already exists
    const existingSubscription = await Subscription.findOne({ userId }).session(session);
    if (existingSubscription) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Subscription already exists'
      });
    }

    // Create trial subscription
    const trialEndDate = new Date();
    const TRIAL_DAYS = Number(process.env.TRIAL_DAYS) || 7;
    trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DAYS);

    const subscription = await Subscription.create([{
      userId,
      organizationId,
      planType: 'trial',
      status: 'trial',
      trialStartDate: new Date(),
      trialEndDate,
      trialOrdersUsed: 0
    }], { session });

    // ✅ Check if tenant settings exist, create only if missing
    const existingSettings = await TenantSettings.findOne({ userId }).session(session);
    
    if (!existingSettings) {
      await TenantSettings.create([{
        userId,
        organizationId,
        enabledModules: ['inventory', 'marketplace-sales'],
        inventoryMode: 'reserved',
        syncSettings: {
          enabled: false
        }
      }], { session });
      console.log('✅ Created new tenant settings for user:', userId);
    } else {
      console.log('✅ Tenant settings already exist, skipping creation');
    }

    // Update user as tenant
    await User.findByIdAndUpdate(
      userId,
      {
        isTenant: true,
        role: 'tenant'
      },
      { session }
    );

    await session.commitTransaction();

    logger.info('Trial subscription initialized', { userId, trialEndDate });

    res.status(201).json({
      success: true,
      message: `Trial started successfully! You have ${TRIAL_DAYS} days and ${Number(process.env.TRIAL_ORDERS_LIMIT) || 500} orders to try all features.`,
      data: {
        subscription: subscription[0],
        trialDaysRemaining: TRIAL_DAYS,
        trialOrdersRemaining: TRIAL_ORDERS_LIMIT
      }
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Trial initialization failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to initialize trial',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// ==================== SUBSCRIPTION RETRIEVAL ====================

// SUBSCRIPTION RETRIEVAL
// Get current subscription details
exports.getSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const MarketplaceSale = require('../models/MarketplaceSale');
    const DirectSale = require('../models/DirectSale');
    const WholesaleOrder = require('../models/WholesaleOrder');
    
    const subscription = await Subscription.findOne({ userId });
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found. Please start a trial.'
      });
    }

    // Calculate usage stats
    let usageStats = {};
    
    if (subscription.planType === 'trial') {
      const daysRemaining = subscription.trialDaysRemaining;
      usageStats = {
        ordersUsed: subscription.trialOrdersUsed,
        ordersLimit: subscription.trialOrdersLimit,
        ordersRemaining: subscription.trialOrdersLimit - subscription.trialOrdersUsed,
        daysRemaining,
        expiryDate: subscription.trialEndDate,
        isExpiringSoon: daysRemaining <= 3,
        isLimitReached: subscription.trialOrdersUsed >= subscription.trialOrdersLimit
      };
      
    } else if (subscription.planType === 'yearly') {
      const daysRemaining = Math.ceil((subscription.yearlyEndDate - new Date()) / (1000 * 60 * 60 * 24));
      usageStats = {
        startDate: subscription.yearlyStartDate,
        expiryDate: subscription.yearlyEndDate,
        daysRemaining: Math.max(0, daysRemaining),
        isExpiringSoon: daysRemaining <= 7 && daysRemaining > 0,
        status: subscription.status
      };
    } else if (subscription.planType === 'monthly') {
    // ✅ Monthly plan support
    const daysRemaining = Math.ceil((subscription.monthlyEndDate - new Date()) / (1000 * 60 * 60 * 24));
    usageStats = {
      startDate: subscription.monthlyStartDate,
      expiryDate: subscription.monthlyEndDate,
      daysRemaining: Math.max(0, daysRemaining),
      isExpiringSoon: daysRemaining <= 3 && daysRemaining > 0,
      status: subscription.status
    };
  
    } else if (subscription.planType === 'order-based') {
      // ✅ Count real orders from all 3 types
      const planStartDate = subscription.orderBasedStartDate;
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      
      // Count ALL orders this month (for display)
      const [marketplaceTotal, directTotal, wholesaleTotal] = await Promise.all([
        MarketplaceSale.countDocuments({
          organizationId: userId,
          deletedAt: null,
          createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
        }),
        DirectSale.countDocuments({
          organizationId: userId,
          deletedAt: null,
          createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
        }),
        WholesaleOrder.countDocuments({
          organizationId: userId,
          deletedAt: null,
          createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
        })
      ]);
      
      const totalOrdersThisMonth = marketplaceTotal + directTotal + wholesaleTotal;
      
      // Count PAID orders (created after plan started)
      let paidOrders = 0;
      if (planStartDate) {
        const [marketplaceAfter, directAfter, wholesaleAfter] = await Promise.all([
          MarketplaceSale.countDocuments({
            organizationId: userId,
            deletedAt: null,
            createdAt: { $gte: new Date(planStartDate) }
          }),
          DirectSale.countDocuments({
            organizationId: userId,
            deletedAt: null,
            createdAt: { $gte: new Date(planStartDate) }
          }),
          WholesaleOrder.countDocuments({
            organizationId: userId,
            deletedAt: null,
            createdAt: { $gte: new Date(planStartDate) }
          })
        ]);
        
        paidOrders = marketplaceAfter + directAfter + wholesaleAfter;
      }
      
      const trialOrders = totalOrdersThisMonth - paidOrders;
      const estimatedBill = paidOrders * subscription.pricePerOrder;
      
      usageStats = {
        pricePerOrder: subscription.pricePerOrder,
        ordersThisMonth: totalOrdersThisMonth,    // ✅ All orders (marketplace + direct + wholesale)
        paidOrders: paidOrders,                   // ✅ Chargeable orders
        trialOrders: trialOrders,                 // ✅ Free trial orders
        marketplaceOrders: marketplaceTotal,      // ✅ Breakdown
        directOrders: directTotal,                // ✅ Breakdown
        wholesaleOrders: wholesaleTotal,          // ✅ Breakdown
        estimatedBill,                            // ✅ Real revenue
        nextBillingDate: subscription.currentBillingCycle.endDate
      };
    }

    res.json({
      success: true,
      data: {
        subscription,
        usageStats
      }
    });

  } catch (error) {
    logger.error('Get subscription failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription',
      error: error.message
    });
  }
};

// ==================== PLAN UPGRADE ====================

// Upgrade from trial to paid plan
exports.upgradePlan = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;
    const { planType, paymentTransactionId, razorpayOrderId, razorpayPaymentId } = req.body;

    if (!['yearly', 'monthly', 'order-based'].includes(planType)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid plan type. Choose "yearly" or "order-based".'
      });
    }

    const subscription = await Subscription.findOne({ userId }).session(session);
    
    if (!subscription) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Subscription not found. Please start a trial first.'
      });
    }

    if (subscription.status === 'active' && subscription.planType === planType) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `You are already on the ${planType} plan.`
      });
    }

    const user = await User.findById(userId).session(session);

    if (planType === 'yearly') {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);

      const yearlyPrice = parseFloat(process.env.YEARLY_PLAN_PRICE) || 5999;

      subscription.planType = 'yearly';
      subscription.status = 'active';
      subscription.yearlyStartDate = startDate;
      subscription.yearlyEndDate = endDate;
      subscription.yearlyPrice = yearlyPrice;
      subscription.lastPaymentDate = new Date();
      subscription.nextPaymentDue = endDate;

      // Clear trial notifications
      subscription.notificationsSent = {};

      await subscription.save({ session });

      // Create invoice for yearly plan (NO GST)
      const totalAmount = yearlyPrice;  // ✅ Simple, no GST

      const invoice = await Invoice.create([{
        userId,
        organizationId: req.user.organizationId || userId,
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: user.phone,
        invoiceType: 'yearly-subscription',
        planType: 'yearly',
        items: [{
          description: 'Annual Subscription - Inventory & Marketplace Management System',
          quantity: 1,
          unitPrice: yearlyPrice,
          amount: yearlyPrice
        }],
        subtotal: yearlyPrice,  // ✅ No GST calculation
        gstRate: 0,  // ✅ Changed to 0
        cgst: 0,  // ✅ Changed to 0
        sgst: 0,  // ✅ Changed to 0
        totalAmount: yearlyPrice,  // ✅ Simple total
        status: 'paid',
        paidAt: new Date(),
        paymentMethod: 'Razorpay',
        paymentTransactionId,
        razorpayOrderId,
        razorpayPaymentId,
        paymentDueDate: new Date(),
        generatedAt: new Date(),
        sentAt: new Date()
      }], { session });

      logger.info('Yearly subscription activated', { userId, invoiceId: invoice[0]._id });

      await session.commitTransaction();

      return res.json({
        success: true,
        message: 'Successfully upgraded to Yearly Plan! Your subscription is valid for 1 year.',
        data: {
          subscription,
          invoice: invoice[0]
        }
      });

    } else if (planType === 'order-based') {
      const startDate = new Date();
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0); // End of current month

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

      // Clear trial notifications
      subscription.notificationsSent = {};

      await subscription.save({ session });

      logger.info('Order-based subscription activated', { userId });

      await session.commitTransaction();

      return res.json({
        success: true,
        message: `Successfully upgraded to Order-Based Plan! You will be charged ₹${subscription.pricePerOrder} per marketplace order.`,
        data: {
          subscription,
          pricePerOrder: subscription.pricePerOrder,
          billingCycle: 'Monthly'
        }
      });
    }

  } catch (error) {
    await session.abortTransaction();
    logger.error('Plan upgrade failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to upgrade plan',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// ==================== ORDER TRACKING ====================

// Track order creation (increment counters) - Called from MarketplaceSale controller
exports.trackOrderCreation = async (userId, orderType = 'marketplace') => {
  try {
    const subscription = await Subscription.findOne({ userId });
    
    if (!subscription) {
      logger.warn('No subscription found for user during order tracking', { userId });
      return { allowed: false, reason: 'NO_SUBSCRIPTION' };
    }

    // Check subscription status
    if (!['trial', 'active', 'grace-period'].includes(subscription.status)) {
      logger.warn('Order creation blocked - subscription not active', { userId, status: subscription.status });
      return { allowed: false, reason: 'SUBSCRIPTION_EXPIRED' };
    }

    if (subscription.planType === 'trial') {
      // Check trial limits
      if (subscription.trialOrdersUsed >= subscription.trialOrdersLimit) {
        subscription.status = 'expired';
        await subscription.save();
        logger.info('Trial expired - order limit reached', { userId });
        return { allowed: false, reason: 'TRIAL_LIMIT_REACHED' };
      }

      if (new Date() > subscription.trialEndDate) {
        subscription.status = 'expired';
        await subscription.save();
        logger.info('Trial expired - time limit reached', { userId });
        return { allowed: false, reason: 'TRIAL_TIME_EXPIRED' };
      }

      subscription.trialOrdersUsed += 1;
      await subscription.save();
      
      logger.info('Trial order tracked', { 
        userId, 
        ordersUsed: subscription.trialOrdersUsed, 
        ordersLimit: subscription.trialOrdersLimit 
      });

    } else if (subscription.planType === 'order-based') {
      subscription.ordersUsedThisMonth += 1;
      subscription.ordersUsedTotal += 1;
      subscription.currentBillingCycle.ordersCount += 1;
      subscription.currentBillingCycle.totalAmount = 
        subscription.currentBillingCycle.ordersCount * subscription.pricePerOrder;

      await subscription.save();
      
      logger.info('Order-based subscription - order tracked', { 
        userId, 
        ordersThisMonth: subscription.ordersUsedThisMonth,
        estimatedBill: subscription.currentBillingCycle.totalAmount
      });

    } else if (subscription.planType === 'yearly') {
      // Check if yearly subscription is still valid
      if (new Date() > subscription.yearlyEndDate) {
        subscription.status = 'expired';
        await subscription.save();
        logger.info('Yearly subscription expired', { userId });
        return { allowed: false, reason: 'SUBSCRIPTION_EXPIRED' };
      }
      
      // No tracking needed for yearly plan (unlimited orders)
      logger.info('Yearly subscription - order recorded', { userId });
    } else if (subscription.planType === 'monthly') {
      // ✅ Check if monthly subscription is still valid
      if (new Date() > subscription.monthlyEndDate) {
        subscription.status = 'expired';
        await subscription.save();
        logger.info('Monthly subscription expired', { userId });
        return { allowed: false, reason: 'SUBSCRIPTION_EXPIRED' };
      }
      
      // No tracking needed for monthly plan (unlimited orders)
      logger.info('Monthly subscription - order recorded', { userId });
    }

    return { allowed: true };  // ← This should be AFTER all the if-else blocks

    } catch (error) {
      logger.error('Order tracking failed', { error: error.message, userId });
      return { allowed: false, reason: 'TRACKING_ERROR' };
    }
};

// ==================== BILLING CYCLE MANAGEMENT ====================

// Generate invoice for order-based plan (called by cron job at month-end)
exports.generateMonthlyInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;

    const subscription = await Subscription.findOne({ userId }).session(session);
    
    if (!subscription || subscription.planType !== 'order-based') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Not on order-based plan'
      });
    }

    if (subscription.currentBillingCycle.invoiceGenerated) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invoice already generated for this cycle'
      });
    }

    const user = await User.findById(userId).session(session);

    const ordersCount = subscription.currentBillingCycle.ordersCount;
    const pricePerOrder = subscription.pricePerOrder;
    const totalAmount = ordersCount * pricePerOrder;  // ✅ Simple, no GST

    // Create invoice (NO GST)
    const invoice = await Invoice.create([{
      userId,
      organizationId: req.user.organizationId || userId,
      customerName: user.name,
      customerEmail: user.email,
      customerPhone: user.phone,
      billingPeriod: {
        startDate: subscription.currentBillingCycle.startDate,
        endDate: subscription.currentBillingCycle.endDate,
        month: subscription.currentBillingCycle.endDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
      },
      invoiceType: 'order-based',
      planType: 'order-based',
      items: [{
        description: `Marketplace Orders (${ordersCount} orders × ₹${pricePerOrder})`,
        quantity: ordersCount,
        unitPrice: pricePerOrder,
        amount: totalAmount
      }],
      subtotal: totalAmount,  // ✅ No GST
      gstRate: 0,  // ✅ Changed to 0
      cgst: 0,  // ✅ Changed to 0
      sgst: 0,  // ✅ Changed to 0
      totalAmount: totalAmount,  // ✅ Simple total
      status: 'generated',
      paymentDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days grace period
      generatedAt: new Date(),
      notes: `Invoice for ${ordersCount} marketplace orders in ${subscription.currentBillingCycle.endDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`
    }], { session });

    // Update subscription
    subscription.currentBillingCycle.invoiceGenerated = true;
    subscription.currentBillingCycle.invoiceId = invoice[0]._id;
    await subscription.save({ session });

    await session.commitTransaction();

    logger.info('Monthly invoice generated', { userId, invoiceId: invoice[0]._id, totalAmount });

    // TODO: Send invoice email

    res.json({
      success: true,
      message: 'Invoice generated successfully',
      data: { invoice: invoice[0] }
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Invoice generation failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// Reset monthly billing cycle (called by cron job on 1st of month)
exports.resetMonthlyCycle = async (userId) => {
  try {
    const subscription = await Subscription.findOne({ userId });
    
    if (!subscription || subscription.planType !== 'order-based') {
      return;
    }

    const startDate = new Date();
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

    subscription.ordersUsedThisMonth = 0;
    subscription.currentBillingCycle = {
      startDate,
      endDate,
      ordersCount: 0,
      totalAmount: 0,
      invoiceGenerated: false
    };

    await subscription.save();

    logger.info('Monthly billing cycle reset', { userId });

  } catch (error) {
    logger.error('Billing cycle reset failed', { error: error.message, userId });
  }
};

// ==================== INVOICE PAYMENT ====================

// Mark invoice as paid
exports.markInvoicePaid = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { invoiceId } = req.params;
    const { paymentTransactionId, razorpayOrderId, razorpayPaymentId, paymentMethod } = req.body;
    const userId = req.user.id;

    const invoice = await Invoice.findOne({ _id: invoiceId, userId }).session(session);
    
    if (!invoice) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    if (invoice.status === 'paid') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invoice already paid'
      });
    }

    invoice.status = 'paid';
    invoice.paidAt = new Date();
    invoice.paymentMethod = paymentMethod || 'Razorpay';
    invoice.paymentTransactionId = paymentTransactionId;
    invoice.razorpayOrderId = razorpayOrderId;
    invoice.razorpayPaymentId = razorpayPaymentId;

    await invoice.save({ session });

    // Update subscription status if it was in grace period
    const subscription = await Subscription.findOne({ userId }).session(session);
    if (subscription && subscription.status === 'grace-period') {
      subscription.status = 'active';
      subscription.lastPaymentDate = new Date();
      await subscription.save({ session });
    }

    await session.commitTransaction();

    logger.info('Invoice marked as paid', { invoiceId, userId });

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      data: { invoice }
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Mark invoice paid failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to record payment',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// Get all invoices for user
exports.getInvoices = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit = 10, page = 1 } = req.query;

    const filter = { userId };
    if (status) filter.status = status;

    const invoices = await Invoice.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    const total = await Invoice.countDocuments(filter);

    res.json({
      success: true,
      data: {
        invoices,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    logger.error('Get invoices failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices',
      error: error.message
    });
  }
};

module.exports = exports;
