// Debug: Log when controller loads
console.log('🔧 Payment Controller Loading...');
console.log('RAZORPAY_KEY_ID:', process.env.RAZORPAY_KEY_ID || 'NOT SET');
console.log('RAZORPAY_KEY_SECRET:', process.env.RAZORPAY_KEY_SECRET ? '***SET***' : 'NOT SET');

const Razorpay = require('razorpay');
const crypto = require('crypto');
const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

let razorpay = null;

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error('❌ WARNING: Razorpay credentials not found!');
  console.error('Looking for: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
} else {
  try {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    console.log('✅ Razorpay initialized successfully!');
    console.log('Key ID:', process.env.RAZORPAY_KEY_ID.substring(0, 15) + '...');
  } catch (error) {
    console.error('❌ Razorpay initialization error:', error.message);
  }
}

// ✅ Pricing in RUPEES (NO GST - from .env)
const PRICING = {
  yearly: parseFloat(process.env.YEARLY_PLAN_PRICE) || 5999,
  monthly: parseFloat(process.env.MONTHLY_PLAN_PRICE) || 999,
  orderBased: parseFloat(process.env.ORDER_BASED_PRICE) || 0.5,
};

// ✅ Helper to convert rupees to paise for Razorpay
const toPaise = (rupees) => Math.round(rupees * 100);

console.log('💰 Pricing loaded from .env (in rupees, NO GST):', {
  yearly: `₹${PRICING.yearly}`,
  monthly: `₹${PRICING.monthly}`,
  orderBased: `₹${PRICING.orderBased} per order`,
  trial: {
    days: parseInt(process.env.TRIAL_DAYS) || 7,
    ordersLimit: parseInt(process.env.TRIAL_ORDERS_LIMIT) || 500
  }
});

// ==================== GET PRICING ENDPOINT ====================
exports.getPricing = (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        yearly: PRICING.yearly,
        monthly: PRICING.monthly,
        orderBased: PRICING.orderBased,
        trial: {
          days: parseInt(process.env.TRIAL_DAYS) || 7,
          ordersLimit: parseInt(process.env.TRIAL_ORDERS_LIMIT) || 500
        },
        gstApplicable: false, // ✅ No GST
        currency: 'INR'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pricing',
      error: error.message
    });
  }
};

// ==================== PRORATION CALCULATOR (NO GST) ====================
const calculateProration = (subscription, newPlanType) => {
  const now = new Date();

  // If upgrading from trial, no proration
  if (subscription.planType === 'trial') {
    return { 
      proratedAmount: 0, 
      fullAmount: getPlanPrice(newPlanType), 
      credited: 0 
    };
  }

  // If upgrading from order-based to monthly/yearly
  if (subscription.planType === 'order-based' && ['monthly', 'yearly'].includes(newPlanType)) {
    return { 
      proratedAmount: 0, 
      fullAmount: getPlanPrice(newPlanType), 
      credited: 0 
    };
  }

  // If upgrading from monthly to yearly
  if (subscription.planType === 'monthly' && newPlanType === 'yearly') {
    const monthlyEndDate = subscription.yearlyEndDate || new Date();
    const daysRemaining = Math.max(0, Math.ceil((monthlyEndDate - now) / (1000 * 60 * 60 * 24)));
    const daysInMonth = 30;

    // Calculate unused credit from monthly plan (in rupees)
    const unusedCredit = (daysRemaining / daysInMonth) * PRICING.monthly;
    const yearlyPrice = PRICING.yearly;
    const finalAmount = Math.max(0, yearlyPrice - unusedCredit);

    return {
      proratedAmount: unusedCredit,
      fullAmount: yearlyPrice,
      credited: unusedCredit,
      daysRemaining,
      newExpiryDate: new Date(now.setFullYear(now.getFullYear() + 1))
    };
  }

  // If upgrading from yearly to yearly (renewal)
  if (subscription.planType === 'yearly' && newPlanType === 'yearly') {
    return { 
      proratedAmount: 0, 
      fullAmount: PRICING.yearly, 
      credited: 0 
    };
  }

  // Default: no proration
  return { 
    proratedAmount: 0, 
    fullAmount: getPlanPrice(newPlanType), 
    credited: 0 
  };
};

const getPlanPrice = (planType) => {
  const prices = {
    'yearly': PRICING.yearly,
    'monthly': PRICING.monthly,
    'order-based': 0, // Pay per order
  };
  return prices[planType] || 0;
};

// ==================== CREATE ORDER (NO GST) ====================
exports.createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { planType } = req.body; // 'monthly', 'yearly', or 'order-based'

    if (!['monthly', 'yearly', 'order-based'].includes(planType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan type'
      });
    }

    const subscription = await Subscription.findOne({ userId });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found'
      });
    }

    // Calculate proration (in rupees, NO GST)
    const proration = calculateProration(subscription, planType);
    const totalAmount = proration.fullAmount - proration.credited;

    // For order-based, don't create Razorpay order (no upfront payment)
    if (planType === 'order-based') {
      return res.json({
        success: true,
        message: 'Order-based plan selected. No upfront payment required.',
        data: {
          planType: 'order-based',
          pricePerOrder: PRICING.orderBased,
          requiresPayment: false
        }
      });
    }

    // ✅ Convert to paise for Razorpay (NO GST added)
    const totalAmountInPaise = toPaise(totalAmount);

    // Create Razorpay order
    console.log('🔄 Creating Razorpay order...');
    console.log('Razorpay instance:', razorpay ? 'EXISTS' : 'NULL');

    if (!razorpay) {
      throw new Error('Razorpay is not initialized');
    }

    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create({
        amount: totalAmountInPaise, // ✅ In paise, NO GST
        currency: 'INR',
        receipt: `order_${Date.now()}`,
        notes: {
          userId: userId.toString(),
          planType,
          amount: totalAmount // Store in rupees
        }
      });
      console.log('✅ Razorpay order created:', razorpayOrder.id);
    } catch (razorpayError) {
      console.error('❌ Razorpay API Error:', razorpayError);
      console.error('Razorpay Error Details:', JSON.stringify(razorpayError, null, 2));
      throw new Error(`Razorpay order creation failed: ${razorpayError.message}`);
    }

    logger.info('Razorpay order created', {
      userId,
      orderId: razorpayOrder.id,
      amount: totalAmount, // Log in rupees
      planType
    });

    res.json({
      success: true,
      data: {
        orderId: razorpayOrder.id,
        amount: totalAmountInPaise, // Paise for Razorpay
        currency: 'INR',
        key: process.env.RAZORPAY_KEY_ID,
        planType,
        proration: {
          ...proration,
          totalAmount,
          // Display values in rupees
          totalAmountRupees: totalAmount,
          creditedRupees: proration.credited
        }
      }
    });

  } catch (error) {
    console.error('❌❌❌ CREATE ORDER ERROR:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    logger.error('Create order failed', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });

    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message,
      details: error.toString()
    });
  }
};

// ==================== VERIFY PAYMENT (NO GST) ====================
exports.verifyPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planType
    } = req.body;

    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed - Invalid signature'
      });
    }

    // Fetch payment details from Razorpay
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (payment.status !== 'captured') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Payment not captured'
      });
    }

    // Update subscription
    const subscription = await Subscription.findOne({ userId }).session(session);

    if (!subscription) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    const user = await User.findById(userId).session(session);
    const now = new Date();
    let endDate;

    // ✅ Simple amount in rupees (NO GST calculations)
    const amountPaid = payment.amount / 100; // Convert paise to rupees

    if (planType === 'yearly') {
      endDate = new Date(now);
      endDate.setFullYear(endDate.getFullYear() + 1);
      
      subscription.planType = 'yearly';
      subscription.status = 'active';
      subscription.yearlyStartDate = now;
      subscription.yearlyEndDate = endDate;
      subscription.yearlyPrice = amountPaid;
      subscription.lastPaymentDate = now;
      subscription.nextPaymentDue = endDate;
    } else if (planType === 'monthly') {
      endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 1);
      
      subscription.planType = 'monthly';
      subscription.status = 'active';
      subscription.yearlyStartDate = now;
      subscription.yearlyEndDate = endDate;
      subscription.yearlyPrice = amountPaid;
      subscription.lastPaymentDate = now;
      subscription.nextPaymentDue = endDate;
    }

    // Clear trial data
    subscription.notificationsSent = {};
    await subscription.save({ session });

    // ✅ Create simple invoice (NO GST)
    const invoiceCount = await Invoice.countDocuments({ userId });
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(5, '0')}`;
    
    console.log('📄 Generated invoice number:', invoiceNumber);

    const invoice = await Invoice.create([{
      userId,
      organizationId: req.user.organizationId || userId,
      invoiceNumber,
      customerName: user.name,
      customerEmail: user.email,
      customerPhone: user.phone,
      invoiceType: planType === 'yearly' ? 'yearly-subscription' : 'monthly-subscription',
      planType,
      items: [{
        description: planType === 'yearly' 
          ? 'Annual Subscription - Inventory & Marketplace Management System'
          : 'Monthly Subscription - Inventory & Marketplace Management System',
        quantity: 1,
        unitPrice: amountPaid,
        amount: amountPaid
      }],
      
      // ✅ Simple amounts (NO GST)
      subtotal: amountPaid,
      gstRate: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalAmount: amountPaid,
      
      status: 'paid',
      paidAt: now,
      paymentMethod: 'Razorpay',
      paymentTransactionId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      paymentDueDate: now,
      generatedAt: now,
      sentAt: now,
      notes: 'Payment received via Razorpay'
    }], { session });

    await session.commitTransaction();

    logger.info('Payment verified and subscription updated', {
      userId,
      planType,
      invoiceId: invoice[0]._id,
      amount: amountPaid
    });

    res.json({
      success: true,
      message: `Successfully subscribed to ${planType} plan!`,
      data: {
        subscription,
        invoice: invoice[0],
        expiryDate: endDate
      }
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Payment verification failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// ==================== UPGRADE PLAN WITH PRORATION (NO GST) ====================
exports.upgradePlanWithProration = async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetPlanType } = req.body; // 'monthly' or 'yearly'

    const subscription = await Subscription.findOne({ userId });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found'
      });
    }

    if (subscription.planType === targetPlanType) {
      return res.status(400).json({
        success: false,
        message: `You are already on the ${targetPlanType} plan`
      });
    }

    // Calculate proration (NO GST)
    const proration = calculateProration(subscription, targetPlanType);

    res.json({
      success: true,
      data: {
        currentPlan: subscription.planType,
        targetPlan: targetPlanType,
        proration: {
          ...proration,
          // Convert to rupees
          fullAmountRupees: proration.fullAmount,
          creditedRupees: proration.credited,
          finalAmountRupees: proration.fullAmount - proration.credited
        }
      }
    });

  } catch (error) {
    logger.error('Calculate upgrade proration failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to calculate upgrade amount',
      error: error.message
    });
  }
};

module.exports = exports;
