const express = require('express');
const router = express.Router();
const {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrder,
  updatePaymentHistory,
  deleteOrder,
  getPendingPayments,
  getAllBuyers,
  getBuyerByMobile,
  getBuyerHistory,
  updateBuyerCredit,
  updateBuyerTrust,
  updateBuyerEmail,
  sendCreditWarning,
  previewChallanNumber,
  recordBulkPayment,
  getBulkPaymentHistory,
  updateBulkPayment,
  deleteBulkPayment,
  previewPaymentAllocation,
  getBuyerStats,
  sendChallanEmail,
  createOrderWithReservedBorrow,
  recordSmartPayment
} = require('../controllers/wholesaleController');

const { protect } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleCheck');

// Get routes - accessible to all authenticated users
router.get('/', protect, getAllOrders);
router.get('/pending-payments', protect, getPendingPayments);

// NEW: Buyer Stats Route
router.get('/stats', protect, getBuyerStats);

// Buyer routes
router.get('/buyers', protect, getAllBuyers);
router.get('/buyers/:mobile', protect, getBuyerByMobile);
router.get('/buyers/:mobile/history', protect, getBuyerHistory);

// Buyer management routes (Admin)
router.put('/buyers/:id/credit', protect, isAdmin, updateBuyerCredit);
router.put('/buyers/:id/trust', protect, updateBuyerTrust);
router.put('/buyers/:id/email', protect, updateBuyerEmail);
router.post('/buyers/:id/send-credit-warning', protect, isAdmin, sendCreditWarning);

// NEW: Bulk Payment Routes
router.post('/buyers/:id/bulk-payment', protect, recordBulkPayment); // Sales + Admin
router.post('/buyers/:id/smart-payment', protect, recordSmartPayment);
router.get('/buyers/:id/payment-history', protect, getBulkPaymentHistory); // Everyone
router.put('/buyers/:id/payments/:paymentId', protect, isAdmin, updateBulkPayment); // Admin only
router.delete('/buyers/:id/payments/:paymentId', protect, isAdmin, deleteBulkPayment); // Admin only
router.post('/buyers/:id/preview-payment', protect, previewPaymentAllocation); // Everyone

// Challan preview route
router.post('/preview-challan', protect, previewChallanNumber);
router.post('/orders/:id/send-email', protect, sendChallanEmail);

// IMPORTANT: Specific routes BEFORE dynamic /:id route
router.put('/:id/payment-history', protect, isAdmin, updatePaymentHistory);

// Order CRUD routes
router.post('/', protect, createOrder);
router.post('/with-reserved-borrow', protect, createOrderWithReservedBorrow);
router.put('/:id', protect, updateOrder);
router.get('/:id', protect, getOrderById);
router.delete('/:id', protect, isAdmin, deleteOrder);

module.exports = router;
