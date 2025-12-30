const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getSalesByChannel,
  getBestSellingDesigns,
  getRevenueTrends,
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');

router.get('/dashboard', protect, getDashboardStats);
router.get('/sales-by-channel', protect, getSalesByChannel);
router.get('/best-selling', protect, getBestSellingDesigns);
router.get('/revenue-trends', protect, getRevenueTrends);

module.exports = router;
