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
    let usageStats;

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
      const daysRemaining = Math.ceil(
        (subscription.yearlyEndDate - new Date()) / (1000 * 60 * 60 * 24)
      );

      usageStats = {
        startDate: subscription.yearlyStartDate,
        expiryDate: subscription.yearlyEndDate,
        daysRemaining: Math.max(0, daysRemaining),
        isExpiringSoon: daysRemaining <= 7 && daysRemaining > 0,
        status: subscription.status
      };
    } else if (subscription.planType === 'monthly') {
      const daysRemaining = Math.ceil(
        (subscription.monthlyEndDate - new Date()) / (1000 * 60 * 60 * 24)
      );

      usageStats = {
        startDate: subscription.monthlyStartDate,
        expiryDate: subscription.monthlyEndDate,
        daysRemaining: Math.max(0, daysRemaining),
        isExpiringSoon: daysRemaining <= 3 && daysRemaining > 0,
        status: subscription.status
      };
    } else if (subscription.planType === 'order-based') {
      // ✅ Count REAL orders from database (current month)
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      // ✅ IMPORTANT: Only count orders created AFTER order-based plan started
      const planStartDate = subscription.orderBasedStartDate || firstDayOfMonth;
      const billingStart = planStartDate > firstDayOfMonth ? planStartDate : firstDayOfMonth;

      console.log('📅 Billing date range:', {
        planStartDate: planStartDate.toISOString(),
        billingStart: billingStart.toISOString(),
        billingEnd: lastDayOfMonth.toISOString()
      });
      
      // Count all orders this month (all types)
      const [marketplaceTotal, directTotal, wholesaleTotal] = await Promise.all([
        MarketplaceSale.countDocuments({
          organizationId: userId,
          deletedAt: null,
          createdAt: { $gte: billingStart, $lte: lastDayOfMonth }
        }),
        DirectSale.countDocuments({
          organizationId: userId,
          deletedAt: null,
          createdAt: { $gte: billingStart, $lte: lastDayOfMonth }
        }),
        WholesaleOrder.countDocuments({
          organizationId: userId,
          deletedAt: null,
          createdAt: { $gte: billingStart, $lte: lastDayOfMonth }
        })
      ]);

      const totalOrdersThisMonth = marketplaceTotal + directTotal + wholesaleTotal;
      const estimatedBill = totalOrdersThisMonth * subscription.pricePerOrder;

      // Calculate billing cycle dates
      const billingCycleStart = subscription.currentBillingCycle?.startDate || firstDayOfMonth;
      const billingCycleEnd = subscription.currentBillingCycle?.endDate || lastDayOfMonth;

      usageStats = {
        pricePerOrder: subscription.pricePerOrder,
        ordersThisMonth: totalOrdersThisMonth, // ✅ Real count from database
        ordersCount: totalOrdersThisMonth, // ✅ Alias for compatibility
        estimatedBill: estimatedBill, // ✅ Calculated from real orders
        marketplaceOrders: marketplaceTotal,
        directOrders: directTotal,
        wholesaleOrders: wholesaleTotal,
        nextBillingDate: billingCycleEnd,
        billingCycleStart: billingCycleStart,
        billingCycleEnd: billingCycleEnd,
        planStartDate: planStartDate,
        status: subscription.status
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
        message: 'Invalid plan type. Choose "yearly", "monthly", or "order-based".'
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

    // ✅ ISSUE 1 FIX: Order-based → new plan
    if (subscription.planType === 'order-based' && planType !== 'order-based') {
      const MarketplaceSale = require('../models/MarketplaceSale');
      const DirectSale = require('../models/DirectSale');
      const WholesaleOrder = require('../models/WholesaleOrder');

      const now = new Date();

      // ✅ STEP 1: Block if there are OLDER unpaid invoices (from previous months)
      const oldUnpaidInvoices = await Invoice.find({
        userId,
        planType: 'order-based',
        status: { $in: ['generated', 'pending'] }
      }).session(session);

      if (oldUnpaidInvoices.length > 0) {
        const totalUnpaid = oldUnpaidInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `You have ${oldUnpaidInvoices.length} unpaid invoice(s) totaling ₹${totalUnpaid.toLocaleString()}. Please clear all pending payments before upgrading.`,
          data: {
            unpaidInvoices: oldUnpaidInvoices.map(inv => ({
              invoiceId: inv._id,
              amount: inv.totalAmount,
              dueDate: inv.paymentDueDate,
              billingPeriod: inv.billingPeriod
            }))
          }
        });
      }

      // ✅ STEP 2: Auto-generate final bill for current month's unbilled orders
      // Only generate if current cycle hasn't already been invoiced
      if (!subscription.currentBillingCycle?.invoiceGenerated) {
        const billingStart = subscription.currentBillingCycle?.startDate
          || new Date(now.getFullYear(), now.getMonth(), 1);
        const billingEnd = now;

        const [marketplaceCount, directCount, wholesaleCount] = await Promise.all([
          MarketplaceSale.countDocuments({
            organizationId: userId,
            deletedAt: null,
            createdAt: { $gte: billingStart, $lte: billingEnd }
          }),
          DirectSale.countDocuments({
            organizationId: userId,
            deletedAt: null,
            createdAt: { $gte: billingStart, $lte: billingEnd }
          }),
          WholesaleOrder.countDocuments({
            organizationId: userId,
            deletedAt: null,
            createdAt: { $gte: billingStart, $lte: billingEnd }
          })
        ]);

        const ordersCount = marketplaceCount + directCount + wholesaleCount;

        if (ordersCount > 0) {
          const pricePerOrder = subscription.pricePerOrder
            || parseFloat(process.env.ORDER_BASED_PRICE) || 0.5;
          const totalAmount = ordersCount * pricePerOrder;

          const user = await User.findById(userId).session(session);
          const invoiceCount = await Invoice.countDocuments({ userId }).session(session);
          const userShortId = userId.toString().slice(-6).toUpperCase();
          const invoiceNumber = `INV-${now.getFullYear()}-${userShortId}-${String(invoiceCount + 1).padStart(3, '0')}`;
          const gracePeriodEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

          const finalBillInvoice = await Invoice.create([{
            userId,
            organizationId: subscription.organizationId,
            invoiceNumber,
            customerName: user.name,
            customerEmail: user.email,
            customerPhone: user.phone,
            billingPeriod: {
              startDate: billingStart,
              endDate: billingEnd,
              month: billingEnd.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
            },
            invoiceType: 'order-based',
            planType: 'order-based',
            items: [{
              description: `Final order-based bill before plan upgrade (${marketplaceCount} marketplace + ${directCount} direct + ${wholesaleCount} wholesale = ${ordersCount} orders × ₹${pricePerOrder})`,
              quantity: ordersCount,
              unitPrice: pricePerOrder,
              amount: totalAmount
            }],
            subtotal: totalAmount,
            gstRate: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            totalAmount,
            status: 'generated',
            paymentDueDate: gracePeriodEnd,
            generatedAt: now,
            notes: `Auto-generated on plan upgrade from order-based to ${planType}. Please pay this invoice separately.`
          }], { session });

          // Mark current billing cycle as invoiced so it doesn't get double-billed
          subscription.currentBillingCycle.invoiceGenerated = true;
          subscription.currentBillingCycle.invoiceId = finalBillInvoice[0]._id;
          subscription.currentBillingCycle.ordersCount = ordersCount;
          subscription.currentBillingCycle.totalAmount = totalAmount;
          // Do NOT save yet — will be saved with plan change below

          logger.info('Auto-generated final order-based bill before upgrade', {
            userId,
            invoiceId: finalBillInvoice[0]._id,
            ordersCount,
            totalAmount,
            upgradingTo: planType
          });
        }
      }
    }

    // ✅ Allow switching plans even if expired
    const isExpired = subscription.status === 'expired' || subscription.status === 'grace-period';
    const isSamePlan = subscription.planType === planType;

    if (subscription.status === 'active' && isSamePlan) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `You are already on the ${planType} plan.`
      });
    }

    const user = await User.findById(userId).session(session);

    // ✅ HANDLE ORDER-BASED PLAN (No upfront payment)
    if (planType === 'order-based') {
      const startDate = new Date();
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

      subscription.planType = 'order-based';
      subscription.status = 'active';
      subscription.orderBasedStartDate = startDate;
      subscription.pricePerOrder = parseFloat(process.env.ORDER_BASED_PRICE) || 0.5;
      subscription.ordersUsedThisMonth = 0;
      subscription.ordersUsedTotal = 0;
      subscription.currentBillingCycle = {
        startDate,
        endDate,
        ordersCount: 0,
        totalAmount: 0,
        invoiceGenerated: false
      };
      subscription.yearlyStartDate = undefined;
      subscription.yearlyEndDate = undefined;
      subscription.yearlyPrice = undefined;
      subscription.monthlyStartDate = undefined;
      subscription.monthlyEndDate = undefined;
      subscription.monthlyPrice = undefined;
      subscription.gracePeriodEndDate = undefined;
      subscription.gracePeriodInvoiceId = undefined;
      subscription.notificationsSent = {};

      await subscription.save({ session });
      await session.commitTransaction();

      logger.info('Order-based subscription activated', { userId });

      return res.json({
        success: true,
        message: `Successfully switched to Order-Based Plan! You will be charged ₹${subscription.pricePerOrder} per order at the end of each month.`,
        data: {
          subscription,
          pricePerOrder: subscription.pricePerOrder,
          billingCycle: 'Monthly',
          note: 'No upfront payment required. First invoice will be generated at month-end.'
        }
      });
    }

    // ✅ HANDLE YEARLY PLAN
    if (planType === 'yearly') {
      if (!paymentTransactionId && !razorpayOrderId) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Payment information required for yearly plan'
        });
      }

      const now = new Date();
      let startDate, endDate;

      if (isExpired) {
        startDate = now;
        endDate = new Date(now);
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else if (isSamePlan && subscription.yearlyEndDate) {
        // Renewing active yearly — extend from current expiry
        startDate = subscription.yearlyStartDate;
        endDate = new Date(subscription.yearlyEndDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        // Upgrading from trial/monthly/order-based → new yearly
        startDate = now;
        endDate = new Date(now);
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      const yearlyPrice = parseFloat(process.env.YEARLY_PLAN_PRICE) || 5999;

      subscription.planType = 'yearly';
      subscription.status = 'active';
      subscription.yearlyStartDate = startDate;
      subscription.yearlyEndDate = endDate;
      subscription.yearlyPrice = yearlyPrice;
      subscription.lastPaymentDate = now;
      subscription.nextPaymentDue = endDate;
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

      const invoiceCount = await Invoice.countDocuments({ userId }).session(session);
      const userShortId = userId.toString().slice(-6).toUpperCase();
      const invoiceNumber = `INV-${now.getFullYear()}-${userShortId}-${String(invoiceCount + 1).padStart(3, '0')}`;

      const invoice = await Invoice.create([{
        userId,
        organizationId: req.user.organizationId || userId,
        invoiceNumber,
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
        subtotal: yearlyPrice,
        gstRate: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalAmount: yearlyPrice,
        status: 'paid',
        paidAt: now,
        paymentMethod: 'Manual Payment',
        paymentTransactionId,
        razorpayOrderId,
        razorpayPaymentId,
        paymentDueDate: now,
        generatedAt: now,
        sentAt: now
      }], { session });

      logger.info('Yearly subscription activated', { userId, invoiceId: invoice[0]._id });
      await session.commitTransaction();

      return res.json({
        success: true,
        message: isExpired
          ? 'Successfully renewed Yearly Plan! Your subscription is valid for 1 year.'
          : 'Successfully upgraded to Yearly Plan! Your subscription is valid for 1 year.',
        data: { subscription, invoice: invoice[0], expiryDate: endDate }
      });
    }

    // ✅ HANDLE MONTHLY PLAN
    if (planType === 'monthly') {
      if (!paymentTransactionId && !razorpayOrderId) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Payment information required for monthly plan'
        });
      }

      const now = new Date();
      let startDate, endDate;

      if (isExpired) {
        startDate = now;
        endDate = new Date(now);
        endDate.setMonth(endDate.getMonth() + 1);
      } else if (isSamePlan && subscription.monthlyEndDate) {
        // Renewing active monthly — extend from current expiry
        startDate = subscription.monthlyStartDate;
        endDate = new Date(subscription.monthlyEndDate);
        endDate.setMonth(endDate.getMonth() + 1);
      } else {
        // Upgrading from trial/order-based → new monthly
        startDate = now;
        endDate = new Date(now);
        endDate.setMonth(endDate.getMonth() + 1);
      }

      const monthlyPrice = parseFloat(process.env.MONTHLY_PLAN_PRICE) || 999;

      subscription.planType = 'monthly';
      subscription.status = 'active';
      subscription.monthlyStartDate = startDate;
      subscription.monthlyEndDate = endDate;
      subscription.monthlyPrice = monthlyPrice;
      subscription.lastPaymentDate = now;
      subscription.nextPaymentDue = endDate;
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

      const invoiceCount = await Invoice.countDocuments({ userId }).session(session);
      const userShortId = userId.toString().slice(-6).toUpperCase();
      const invoiceNumber = `INV-${now.getFullYear()}-${userShortId}-${String(invoiceCount + 1).padStart(3, '0')}`;

      const invoice = await Invoice.create([{
        userId,
        organizationId: req.user.organizationId || userId,
        invoiceNumber,
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: user.phone,
        invoiceType: 'monthly-subscription',
        planType: 'monthly',
        items: [{
          description: 'Monthly Subscription - Inventory & Marketplace Management System',
          quantity: 1,
          unitPrice: monthlyPrice,
          amount: monthlyPrice
        }],
        subtotal: monthlyPrice,
        gstRate: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalAmount: monthlyPrice,
        status: 'paid',
        paidAt: now,
        paymentMethod: 'Manual Payment',
        paymentTransactionId,
        razorpayOrderId,
        razorpayPaymentId,
        paymentDueDate: now,
        generatedAt: now,
        sentAt: now
      }], { session });

      logger.info('Monthly subscription activated', { userId, invoiceId: invoice[0]._id });
      await session.commitTransaction();

      return res.json({
        success: true,
        message: isExpired
          ? 'Successfully renewed Monthly Plan! Your subscription is valid for 1 month.'
          : 'Successfully upgraded to Monthly Plan! Your subscription is valid for 1 month.',
        data: { subscription, invoice: invoice[0], expiryDate: endDate }
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

// Track order creation (increment counters)
exports.trackOrderCreation = async (userId, orderType = 'marketplace') => {
  try {
    const subscription = await Subscription.findOne({ userId });

    if (!subscription) {
      logger.warn('No subscription found for user during order tracking', { userId });
      return { allowed: false, reason: 'NO_SUBSCRIPTION' };
    }

    // ✅ Check if grace period expired
    if (subscription.status === 'grace-period') {
      if (subscription.gracePeriodEndDate && new Date() > subscription.gracePeriodEndDate) {
        // Grace period ended - expire subscription
        subscription.status = 'expired';
        subscription.notificationsSent.gracePeriodExpired = true;
        await subscription.save();
        
        logger.info('Grace period expired - subscription now expired', { userId });
        return { 
          allowed: false, 
          reason: 'GRACE_PERIOD_EXPIRED',
          message: 'Your grace period has expired. Please pay your pending invoice to continue.'
        };
      }
    }

    // ✅ Allow orders during trial, active, and grace-period
    if (!['trial', 'active', 'grace-period'].includes(subscription.status)) {
      logger.warn('Order creation blocked - subscription not active', { 
        userId, 
        status: subscription.status 
      });
      return { 
        allowed: false, 
        reason: 'SUBSCRIPTION_EXPIRED',
        message: 'Your subscription has expired. Please renew to continue.'
      };
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
        estimatedBill: subscription.currentBillingCycle.totalAmount,
        status: subscription.status,
        inGracePeriod: subscription.status === 'grace-period'
      });

    } else if (subscription.planType === 'yearly') {
      if (new Date() > subscription.yearlyEndDate) {
        subscription.status = 'expired';
        await subscription.save();
        logger.info('Yearly subscription expired', { userId });
        return { allowed: false, reason: 'SUBSCRIPTION_EXPIRED' };
      }

      logger.info('Yearly subscription - order recorded', { userId });

    } else if (subscription.planType === 'monthly') {
      if (new Date() > subscription.monthlyEndDate) {
        subscription.status = 'expired';
        await subscription.save();
        logger.info('Monthly subscription expired', { userId });
        return { allowed: false, reason: 'SUBSCRIPTION_EXPIRED' };
      }

      logger.info('Monthly subscription - order recorded', { userId });
    }

    return { allowed: true };

  } catch (error) {
    logger.error('Order tracking failed', { error: error.message, userId });
    return { allowed: false, reason: 'TRACKING_ERROR' };
  }
};

// ==================== BILLING CYCLE MANAGEMENT ====================

exports.generateMonthlyInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId } = req.body;
    const targetUserId = userId || req.user.id;

    const subscription = await Subscription.findOne({ userId: targetUserId }).session(session);

    if (!subscription || subscription.planType !== 'order-based') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Not on order-based plan'
      });
    }

    if (subscription.currentBillingCycle?.invoiceGenerated) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invoice already generated for this billing cycle'
      });
    }

    const MarketplaceSale = require('../models/MarketplaceSale');
    const DirectSale = require('../models/DirectSale');
    const WholesaleOrder = require('../models/WholesaleOrder');

    // ✅ Use billing cycle dates OR plan start date
    const billingStart = subscription.currentBillingCycle?.startDate || 
                         subscription.orderBasedStartDate ||
                         new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    
    const billingEnd = subscription.currentBillingCycle?.endDate || 
                       new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

    console.log('📅 Invoice billing period:', {
      billingStart: billingStart.toISOString(),
      billingEnd: billingEnd.toISOString(),
      planStartDate: subscription.orderBasedStartDate?.toISOString()
    });

    // ✅ Count orders in billing period (AFTER plan started)
    const [marketplaceCount, directCount, wholesaleCount] = await Promise.all([
      MarketplaceSale.countDocuments({
        organizationId: targetUserId,
        deletedAt: null,
        createdAt: { 
          $gte: billingStart,  // ✅ Only after plan started
          $lte: billingEnd 
        }
      }),
      DirectSale.countDocuments({
        organizationId: targetUserId,
        deletedAt: null,
        createdAt: { 
          $gte: billingStart,
          $lte: billingEnd 
        }
      }),
      WholesaleOrder.countDocuments({
        organizationId: targetUserId,
        deletedAt: null,
        createdAt: { 
          $gte: billingStart,
          $lte: billingEnd 
        }
      })
    ]);

    const ordersCount = marketplaceCount + directCount + wholesaleCount;
    const pricePerOrder = subscription.pricePerOrder;
    const totalAmount = ordersCount * pricePerOrder;

    console.log('📊 Invoice order counts:', {
      marketplace: marketplaceCount,
      direct: directCount,
      wholesale: wholesaleCount,
      total: ordersCount,
      amount: totalAmount
    });

    // ✅ Skip if no orders
    if (ordersCount === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'No billable orders in current billing cycle'
      });
    }

    const user = await User.findById(targetUserId).session(session);
    const now = new Date();
    const gracePeriodEnd = new Date(now);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);

    // Generate invoice number
    const invoiceCount = await Invoice.countDocuments({ userId: targetUserId });
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(5, '0')}`;

    // Create invoice
    const invoice = await Invoice.create([{
      userId: targetUserId,
      organizationId: subscription.organizationId,
      invoiceNumber,
      customerName: user.name,
      customerEmail: user.email,
      customerPhone: user.phone,
      billingPeriod: {
        startDate: billingStart,
        endDate: billingEnd,
        month: billingEnd.toLocaleDateString('en-IN', { 
          month: 'long', 
          year: 'numeric' 
        })
      },
      invoiceType: 'order-based',
      planType: 'order-based',
      items: [{
        description: `Orders from ${billingStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} to ${billingEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} (${marketplaceCount} marketplace + ${directCount} direct + ${wholesaleCount} wholesale = ${ordersCount} total × ₹${pricePerOrder})`,
        quantity: ordersCount,
        unitPrice: pricePerOrder,
        amount: totalAmount
      }],
      subtotal: totalAmount,
      gstRate: 0,
      cgst: 0,
      sgst: 0,
      totalAmount: totalAmount,
      status: 'generated',
      paymentDueDate: gracePeriodEnd,
      generatedAt: now,
      notes: `Invoice for ${ordersCount} billable orders (Marketplace: ${marketplaceCount}, Direct: ${directCount}, Wholesale: ${wholesaleCount}) from ${billingStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} to ${billingEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
    }], { session });

    // ✅ Update subscription
    subscription.currentBillingCycle.invoiceGenerated = true;
    subscription.currentBillingCycle.invoiceId = invoice[0]._id;
    subscription.currentBillingCycle.ordersCount = ordersCount;
    subscription.currentBillingCycle.totalAmount = totalAmount;
    subscription.status = 'grace-period';
    subscription.gracePeriodEndDate = gracePeriodEnd;
    subscription.gracePeriodInvoiceId = invoice[0]._id;
    subscription.notificationsSent.invoiceGenerated = true;
    subscription.notificationsSent.gracePeriodStarted = true;

    await subscription.save({ session });
    await session.commitTransaction();

    logger.info('Monthly invoice generated', { 
      userId: targetUserId, 
      invoiceId: invoice[0]._id, 
      ordersCount,
      totalAmount,
      billingPeriod: `${billingStart.toISOString()} - ${billingEnd.toISOString()}`
    });

    res.json({
      success: true,
      message: `Invoice generated successfully for ${ordersCount} billable orders. User has until ${gracePeriodEnd.toLocaleDateString('en-IN')} to pay.`,
      data: { 
        invoice: invoice[0],
        gracePeriodEnd,
        daysToPayment: 7,
        breakdown: {
          marketplace: marketplaceCount,
          direct: directCount,
          wholesale: wholesaleCount,
          total: ordersCount
        },
        billingPeriod: {
          start: billingStart,
          end: billingEnd
        }
      }
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

// ✅ Mark invoice as paid and reset billing cycle
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
    invoice.paymentMethod = paymentMethod || 'Manual';
    invoice.paymentTransactionId = paymentTransactionId;
    invoice.razorpayOrderId = razorpayOrderId;
    invoice.razorpayPaymentId = razorpayPaymentId;

    await invoice.save({ session });

    // ✅ Update subscription - clear grace period and reset billing cycle
    const subscription = await Subscription.findOne({ userId }).session(session);

    if (subscription && subscription.planType === 'order-based') {
      // Reactivate subscription
      subscription.status = 'active';
      subscription.lastPaymentDate = new Date();
      
      // ✅ Clear grace period data
      subscription.gracePeriodEndDate = undefined;
      subscription.gracePeriodInvoiceId = undefined;
      
      // ✅ Reset billing cycle for next month
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      subscription.currentBillingCycle = {
        startDate,
        endDate,
        ordersCount: 0,
        totalAmount: 0,
        invoiceGenerated: false
      };
      
      subscription.ordersUsedThisMonth = 0;
      
      await subscription.save({ session });

      logger.info('Subscription reactivated and billing cycle reset', { userId });
    }

    await session.commitTransaction();

    logger.info('Invoice marked as paid', { invoiceId, userId });

    res.json({
      success: true,
      message: 'Payment recorded successfully. Subscription reactivated and new billing cycle started!',
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

// 🆕 Submit manual payment request for invoice
exports.submitInvoicePaymentRequest = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { paymentMethod } = req.body;
    const userId = req.user.id;

    if (!['upi', 'cash'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method. Use "upi" or "cash".'
      });
    }

    const Invoice = require('../models/Invoice');
    const invoice = await Invoice.findOne({ _id: invoiceId, userId });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Invoice is already paid'
      });
    }

    // Check if there's already a pending request for this invoice
    const ManualPaymentRequest = require('../models/ManualPaymentRequest');
    const existingRequest = await ManualPaymentRequest.findOne({
      invoiceId,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending payment request for this invoice.'
      });
    }

    const User = require('../models/User');
    const user = await User.findById(userId);

    // Create payment request
    const paymentRequest = await ManualPaymentRequest.create({
      userId,
      organizationId: req.user.organizationId || userId,
      planType: 'invoice-payment',
      amount: invoice.totalAmount,
      paymentMethod,
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      userDetails: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        businessName: user.businessName || user.companyName
      }
    });

    logger.info('Invoice payment request submitted', {
      userId,
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.totalAmount,
      paymentMethod
    });

    res.json({
      success: true,
      message: 'Payment request submitted successfully. Admin will verify within 24 hours.',
      data: { paymentRequest }
    });

  } catch (error) {
    logger.error('Invoice payment request failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to submit payment request',
      error: error.message
    });
  }
};

module.exports = exports;
