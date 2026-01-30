const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

router.get('/pricing', protect, paymentController.getPricing);
router.post('/create-order', protect, paymentController.createOrder);
router.post('/verify-payment', protect, paymentController.verifyPayment);

module.exports = router;
