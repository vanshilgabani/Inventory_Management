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
  recordSmartPayment,
  getBuyerMonthlyHistory,
  deleteOrderPayment,
  getTenantUsers,           // ✅ ADD
  linkBuyerToTenant,        // ✅ ADD
  getBuyerTenantInfo,
  getOrderSyncStatus
} = require('../controllers/wholesaleController');

// NEW: Import GST Profile Controller
const {
  verifyGSTNumber,
  getGSTProfiles,
  addGSTProfile,
  updateGSTProfile,
  deleteGSTProfile,
  refreshGSTProfile
} = require('../controllers/buyerGSTController');

const { protect } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleCheck');

// ============================================
// 🔥 SPECIFIC ROUTES FIRST (before any /:id or /:mobile)
// ============================================

// ✅ GST Verification Route (standalone, not tied to buyer)
router.post('/verify-gst', protect, verifyGSTNumber);

// Stats & Summary Routes
router.get('/stats', protect, getBuyerStats);
router.get('/pending-payments', protect, getPendingPayments);

// Buyer List Route
router.get('/buyers', protect, getAllBuyers);

// Challan Preview Routes
router.post('/preview-challan', protect, previewChallanNumber);

// Order Creation Routes (non-dynamic)
router.post('/with-reserved-borrow', protect, createOrderWithReservedBorrow);

// ============================================
// 🔥 BUYER ROUTES WITH :id or :mobile (specific paths first)
// ============================================

// GST Profile Routes for Buyers
router.get('/buyers/:buyerId/gst-profiles', protect, getGSTProfiles);
router.post('/buyers/:buyerId/gst-profiles', protect, addGSTProfile);
router.put('/buyers/:buyerId/gst-profiles/:profileId', protect, updateGSTProfile);
router.delete('/buyers/:buyerId/gst-profiles/:profileId', protect, deleteGSTProfile);
router.post('/buyers/:buyerId/gst-profiles/:profileId/refresh', protect, refreshGSTProfile);

// Buyer Monthly History
router.get('/buyers/:id/monthly-history', protect, getBuyerMonthlyHistory);

// Buyer History by Mobile
router.get('/buyers/:mobile/history', protect, getBuyerHistory);

// Buyer Management Routes (Admin)
router.put('/buyers/:id/credit', protect, isAdmin, updateBuyerCredit);
router.put('/buyers/:id/trust', protect, updateBuyerTrust);
router.put('/buyers/:id/email', protect, updateBuyerEmail);
router.post('/buyers/:id/send-credit-warning', protect, isAdmin, sendCreditWarning);

// Bulk Payment Routes
router.post('/buyers/:id/bulk-payment', protect, recordBulkPayment);
router.post('/buyers/:id/smart-payment', protect, recordSmartPayment);
router.get('/buyers/:id/payment-history', protect, getBulkPaymentHistory);
router.put('/buyers/:id/payments/:paymentId', protect, isAdmin, updateBulkPayment);
router.delete('/buyers/:id/payments/:paymentId', protect, isAdmin, deleteBulkPayment);
router.post('/buyers/:id/preview-payment', protect, previewPaymentAllocation);

// Buyer by Mobile (more specific than generic /:id)
router.get('/buyers/:mobile', protect, getBuyerByMobile);
// Tenant Linking Routes
router.get('/tenants', protect, getTenantUsers);
router.put('/buyers/:buyerId/link-tenant', protect, linkBuyerToTenant);
router.get('/buyers/:buyerId/tenant-info', protect, getBuyerTenantInfo);

// ============================================
// 🔥 ORDER SYNC STATUS (BEFORE generic /:id)
// ============================================
router.get('/orders/:id/sync-status', protect, getOrderSyncStatus);

// ============================================
// 🔥 ORDER ROUTES WITH :id (specific actions first)
// ============================================

// Order Email Route
router.post('/orders/:id/send-email', protect, sendChallanEmail);

// Order Payment History Update
router.put('/:id/payment-history', protect, isAdmin, updatePaymentHistory);

// Delete Order Payment
router.delete('/:id/payments/:paymentIndex', protect, isAdmin, deleteOrderPayment);

// Order Update & Get (generic /:id routes)
router.put('/:id', protect, updateOrder);
router.get('/:id', protect, getOrderById);
router.delete('/:id', protect, isAdmin, deleteOrder);

// ============================================
// 🔥 GENERIC ROUTES (at the end)
// ============================================

// Get All Orders
router.get('/', protect, getAllOrders);

// Create Order
router.post('/', protect, createOrder);

module.exports = router;

