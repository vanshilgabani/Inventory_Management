const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { protect } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleCheck');

// Basic settings routes
router.get('/', protect, settingsController.getSettings);
router.put('/', protect, isAdmin, settingsController.updateSettings);

// 🔒 NEW: Stock lock routes
router.post('/reduce-stock-lock', protect, settingsController.reduceStockLock);

// Marketplace account routes
router.post('/marketplace-accounts', protect, isAdmin, settingsController.addMarketplaceAccount);
router.put('/marketplace-accounts/:accountId', protect, isAdmin, settingsController.updateMarketplaceAccount);
router.delete('/marketplace-accounts/:accountId', protect, isAdmin, settingsController.deleteMarketplaceAccount);
router.put('/marketplace-accounts/:accountId/set-default', protect, isAdmin, settingsController.setDefaultMarketplaceAccount);

router.post('/stock-lock/toggle', protect, isAdmin, settingsController.toggleStockLock);
router.post('/stock-lock/set-variant', protect, isAdmin, settingsController.setVariantLockAmount);
router.post('/stock-lock/refill', protect, isAdmin, settingsController.refillLockedStock);
router.get('/stock-lock', protect, settingsController.getStockLockSettings);
router.post('/stock-lock/distribute', protect, settingsController.distributeStockLock);

// ✅ NEW: Color Palette Routes (with authentication)
router.get('/color-palette', protect, settingsController.getColorPalette);
router.post('/color-palette', protect, isAdmin, settingsController.addColorToPalette);
router.put('/color-palette/reorder', protect, isAdmin, settingsController.reorderColors);
router.put('/color-palette/:colorId', protect, isAdmin, settingsController.updateColorInPalette);
router.delete('/color-palette/:colorId', protect, isAdmin, settingsController.deleteColorFromPalette);

// Stock threshold routes
router.get('/stock-thresholds', protect, settingsController.getStockThresholds);
router.put('/stock-thresholds', protect, isAdmin, settingsController.updateStockThresholds);
router.post('/stock-thresholds/design', protect, isAdmin, settingsController.addDesignThreshold);
router.delete('/stock-thresholds/design/:design', protect, isAdmin, settingsController.removeDesignThreshold);

// Company info routes
router.put('/company', protect, isAdmin, settingsController.updateCompanyInfo);

// GST routes
router.put('/gst', protect, isAdmin, settingsController.updateGST);

// Size routes
router.put('/sizes', protect, isAdmin, settingsController.updateEnabledSizes);

// Permission routes
router.put('/permissions', protect, isAdmin, settingsController.updatePermissions);

module.exports = router;
