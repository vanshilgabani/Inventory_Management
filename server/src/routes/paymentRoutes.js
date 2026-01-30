const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const manualPaymentController = require('../controllers/manualPaymentController'); // NEW
const { protect } = require('../middleware/auth');

// Existing routes
router.get('/pricing', protect, paymentController.getPricing);
router.post('/create-order', protect, paymentController.createOrder);
router.post('/verify-payment', protect, paymentController.verifyPayment);

// NEW: Manual payment routes
router.post('/manual-payment-request', protect, manualPaymentController.createManualPaymentRequest);
router.get('/my-payment-requests', protect, manualPaymentController.getMyPaymentRequests);

// Admin routes for manual payment verification
router.get('/admin/payment-requests', protect, manualPaymentController.getAllPaymentRequests);
router.put('/admin/payment-requests/:requestId/approve', protect, manualPaymentController.approvePaymentRequest);
router.put('/admin/payment-requests/:requestId/reject', protect, manualPaymentController.rejectPaymentRequest);

module.exports = router;
