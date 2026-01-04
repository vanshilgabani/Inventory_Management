const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const {protect} = require('../middleware/auth');
const {isAdmin} = require('../middleware/roleCheck');

// Get all sales
router.get('/', protect, salesController.getAllSales);
// Get sales statistics
router.get('/stats', protect, salesController.getSalesStats);

// Get single sale by ID
router.get('/:id', protect, salesController.getSaleById);

// Create new sale
router.post('/', protect, isAdmin, salesController.createSale);

// Create sale with main stock (when reserved insufficient)
router.post('/with-main-stock', protect, isAdmin, salesController.createSaleWithMainStock);

// ✅ NEW: Import from CSV
router.post('/import-csv', protect, isAdmin, salesController.importFromCSV);

// Update sale
router.put('/:id', protect, salesController.updateSale);

// Delete sale
router.delete('/:id', protect, isAdmin, salesController.deleteSale);

// Bulk mark as delivered
router.post('/bulk-delivered', protect, isAdmin, salesController.bulkMarkDelivered);

// Export orders to CSV
router.get('/export/csv', protect, salesController.exportOrders);

module.exports = router;
