// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getMarketplaceSalesMatrix,
  getMarketplaceSalesDetail,
  exportMarketplaceSalesDetail,
  getMarketplaceSalesMatrixExport
} = require('../controllers/reportController');

// ─── Marketplace Sales Reports ────────────────────────────────────────────────

router.get('/marketplace/sales-matrix', protect, getMarketplaceSalesMatrix);
router.get('/marketplace/sales-detail', protect, getMarketplaceSalesDetail);
router.get('/marketplace/sales-detail/export', protect, exportMarketplaceSalesDetail);
router.get('/marketplace/sales-matrix-export', protect, getMarketplaceSalesMatrixExport);

module.exports = router;