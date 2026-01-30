const express = require('express');
const router = express.Router();
const supplierSyncController = require('../controllers/supplierSyncController');
const {protect} = require('../middleware/auth');

// Get all supplier sync logs (admin only)
router.get('/supplier-logs', protect, supplierSyncController.getAllSupplierSyncLogs);

// 🆕 NEW: Get pending sync requests (customer side)
router.get('/pending', protect, supplierSyncController.getPendingSyncRequests);

// 🆕 NEW: Accept sync request (customer side)
router.post('/:syncId/accept', protect, supplierSyncController.acceptSyncRequest);

// 🆕 NEW: Reject sync request (customer side)
router.post('/:syncId/reject', protect, supplierSyncController.rejectSyncRequest);

// 🆕 NEW: Resend sync request (supplier side)
router.post('/resend/:orderId', protect, supplierSyncController.resendSyncRequest);

// Get received orders from supplier (customer side)
router.get('/received-from-supplier', protect, supplierSyncController.getReceivedFromSupplier);

module.exports = router;
