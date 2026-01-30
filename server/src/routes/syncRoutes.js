// routes/syncRoutes.js
const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');
const { protect } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleCheck'); // ✅ ADD

// Tenant sync logs (for customers viewing their received orders)
router.get('/tenant/logs', protect, syncController.getTenantSyncLogs);
router.put('/tenant/logs/:syncLogId/accept', protect, syncController.acceptSyncedOrder);
router.put('/tenant/logs/:syncLogId/report-issue', protect, syncController.reportSyncIssue);

// Supplier sync logs (admin only - view all synced orders)
router.get('/supplier-logs', protect, isAdmin, syncController.getSupplierSyncLogs); // ✅ ADD isAdmin

module.exports = router;
