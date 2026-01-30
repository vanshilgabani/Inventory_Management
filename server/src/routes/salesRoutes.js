const express = require('express');
const router = express.Router();
const {
  createSale,
  createSaleWithMainStock,
  getAllSales,
  getSalesStats,
  getSaleById,
  updateSale,
  deleteSale,
  bulkMarkDelivered,
  exportOrders,
  importFromCSV,
  searchSales,
  getOrdersByDate,
  getDateSummary,
  searchOrderGlobally,
  getStatsForCards,
  getOrdersByDateGroups,
  searchByDate
} = require('../controllers/salesController');
const { protect } = require('../middleware/auth');
const { canEditDelete } = require('../middleware/checkEditPermission'); // ✅ ADD THIS

router.get('/stats-cards', protect, getStatsForCards);
router.get('/by-date-groups', protect, getOrdersByDateGroups);
router.get('/search-by-date', protect, searchByDate);

router.get('/dates-summary', protect, getDateSummary);
router.get('/by-date', protect, getOrdersByDate);
router.get('/search', protect, searchSales);
router.get('/search-global', protect, searchOrderGlobally);

// Create routes (no middleware needed)
router.post('/', protect, createSale);
router.post('/with-main-stock', protect, createSaleWithMainStock);
router.post('/import-csv', protect, importFromCSV);

// Read routes (no middleware needed)
router.get('/', protect, getAllSales);
router.get('/stats', protect, getSalesStats);
router.get('/export', protect, exportOrders);
router.get('/:id', protect, getSaleById);

// ✅ UPDATE/DELETE routes - APPLY MIDDLEWARE
router.put('/:id', protect, updateSale);
router.delete('/:id', protect, canEditDelete, deleteSale);
router.post('/bulk-delivered', protect, canEditDelete, bulkMarkDelivered);

module.exports = router;
