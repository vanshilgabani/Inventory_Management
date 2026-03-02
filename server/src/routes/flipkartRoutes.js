const express = require('express');
const router = express.Router();
const {
  getFlipkartSettings,
  updateFlipkartSettings,
  testCredentials,
  toggleProductSync,
  updateProductMapping,
  getFlipkartProducts,
  manualSync,
  getSyncStatus,
  getSyncHistory,
  bulkUpdateProducts
} = require('../controllers/flipkartController');
const { protect } = require('../middleware/auth');

// Settings routes
router.get('/settings', protect, getFlipkartSettings);
router.put('/settings', protect, updateFlipkartSettings);
router.post('/test-credentials', protect, testCredentials);

// Product management routes
router.get('/products', protect, getFlipkartProducts);
router.put('/products/:id/toggle', protect, toggleProductSync);
router.put('/products/:id/mapping', protect, updateProductMapping);
router.post('/products/bulk-update', protect, bulkUpdateProducts);

// Sync routes
router.post('/sync/manual', protect, manualSync); // ✅ Manual sync button
router.get('/sync/status', protect, getSyncStatus); // ✅ Get sync status
router.get('/sync/history', protect, getSyncHistory);

module.exports = router;
