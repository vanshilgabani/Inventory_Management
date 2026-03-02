const express = require('express');
const router = express.Router();
const supplierSyncController = require('../controllers/supplierSyncController');
const { protect } = require('../middleware/auth');

router.get('/supplier-logs', protect, supplierSyncController.getAllSupplierSyncLogs);
router.get('/pending', protect, supplierSyncController.getPendingSyncRequests);
router.post('/:syncId/accept', protect, supplierSyncController.acceptSyncRequest);
router.post('/:syncId/reject', protect, supplierSyncController.rejectSyncRequest);
router.post('/resend/:orderId', protect, supplierSyncController.resendSyncRequest);
router.get('/received-from-supplier', protect, supplierSyncController.getReceivedFromSupplier);

module.exports = router;
