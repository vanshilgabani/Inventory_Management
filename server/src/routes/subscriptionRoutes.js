// routes/subscriptionRoutes.js
const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

// Trial management
router.post('/initialize-trial', protect, subscriptionController.initializeTrial);

// Subscription info
router.get('/', protect, subscriptionController.getSubscription);
// Update trial limit (temporary admin function)
router.put('/update-trial-limit', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { trialOrdersLimit } = req.body;
    
    const subscription = await require('../models/Subscription').findOneAndUpdate(
      { userId },
      { trialOrdersLimit },
      { new: true }
    );
    
    res.json({ success: true, data: { subscription } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update price per order (temporary admin function)
router.put('/update-price', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { pricePerOrder } = req.body;
    
    const subscription = await require('../models/Subscription').findOneAndUpdate(
      { userId },
      { pricePerOrder },
      { new: true }
    );
    
    res.json({ success: true, data: { subscription } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// TEST ONLY - Set trial expiry date
router.put('/set-trial-expiry', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { trialEndDate } = req.body;
    
    const subscription = await require('../models/Subscription').findOneAndUpdate(
      { userId },
      { trialEndDate: new Date(trialEndDate) },
      { new: true }
    );
    
    res.json({ success: true, data: { subscription } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// TESTING ONLY - Reset subscription to trial
router.put('/reset-to-trial', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const Subscription = require('../models/Subscription');
    
    const trialStartDate = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7); // 7 days trial
    
    const subscription = await Subscription.findOneAndUpdate(
      { userId },
      {
        planType: 'trial',
        status: 'trial',
        trialStartDate,
        trialEndDate,
        trialOrdersUsed: 0,
        trialOrdersLimit: 500,
        pricePerOrder: 0.5,
        // Clear order-based fields
        orderBasedStartDate: null,
        ordersUsedThisMonth: 0,
        ordersUsedTotal: 0,
        // Clear yearly fields
        yearlyStartDate: null,
        yearlyEndDate: null,
        yearlyPrice: 0
      },
      { new: true }
    );
    
    res.json({ 
      success: true, 
      message: 'Subscription reset to trial',
      data: { subscription } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// TESTING ONLY - Delete all orders for current user
router.delete('/delete-all-test-orders', protect, async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const MarketplaceSale = require('../models/MarketplaceSale');
    
    const result = await MarketplaceSale.deleteMany({ 
      organizationId,
      deletedAt: null 
    });
    
    res.json({ 
      success: true, 
      message: `Deleted ${result.deletedCount} orders`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/invoices', protect, subscriptionController.getInvoices);

// Payment routes
router.post('/create-order', protect, paymentController.createOrder);
router.post('/verify-payment', protect, paymentController.verifyPayment);
router.post('/calculate-upgrade', protect, paymentController.upgradePlanWithProration);

// Plan upgrade (legacy - for order-based without payment)
router.post('/upgrade', protect, subscriptionController.upgradePlan);

// Invoice management
router.post('/invoices/:invoiceId/mark-paid', protect, subscriptionController.markInvoicePaid);
router.post('/generate-monthly-invoice', protect, subscriptionController.generateMonthlyInvoice);

module.exports = router;
