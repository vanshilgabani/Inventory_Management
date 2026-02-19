const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');

// Section 1: Wholesale & Direct Analytics
router.get('/wholesale/top-buyers', protect, analyticsController.getTopWholesaleBuyers);
router.get('/wholesale/buyer-products', protect, analyticsController.getTopProductsPerBuyer);
router.get('/wholesale/buyer-design-drilldown', protect, analyticsController.getBuyerDesignDrilldown);
router.get('/wholesale/revenue-trends', protect, analyticsController.getWholesaleRevenueTrends);
router.get('/direct/sales-amount', protect, analyticsController.getDirectSalesAmount);
router.get('/sales-velocity', protect, analyticsController.getSalesVelocityByProduct);

// Section 2: Marketplace Analytics
router.get('/marketplace/account-stats', protect, analyticsController.getMarketplaceAccountStats);
router.get('/marketplace/return-rate', protect, analyticsController.getReturnRateByProduct);
router.get('/marketplace/best-selling', protect, analyticsController.getBestSellingMarketplaceProducts);
router.get('/marketplace/stock-recommendations', protect, analyticsController.getStockRecommendations);

// Inventory Intelligence
router.get('/inventory/stock-levels', protect, analyticsController.getCurrentStockLevels);
router.get('/inventory/turnover-rate', protect, analyticsController.getStockTurnoverRate);
router.get('/inventory/stock-value', protect, analyticsController.getStockValueByType);
router.get('/inventory/reorder-points', protect, analyticsController.getOptimalReorderPoints);
router.get('/inventory/color-size-distribution', protect, analyticsController.getColorSizeDistribution);

// Growth Metrics
router.get('/growth-metrics', protect, analyticsController.getGrowthMetrics);

module.exports = router;
