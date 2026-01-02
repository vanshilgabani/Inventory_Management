const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { protect } = require('../middleware/auth');
const { canEditDelete } = require('../middleware/checkEditPermission'); // ✅ NEW

// ============ SPECIAL ROUTES (BEFORE /:id) ============
router.get('/stats', protect, salesController.getSalesStats);
router.get('/export/excel', protect, salesController.exportOrders);

// ============ CRUD ROUTES ============
router.post('/', protect, salesController.createSale);
router.post('/with-main-stock', protect, salesController.createSaleWithMainStock);
router.get('/', protect, salesController.getAllSales);
router.post('/bulk/delivered', protect, salesController.bulkMarkDelivered);

// ⚠️ IMPORTANT: /:id must be LAST
router.get('/:id', protect, salesController.getSaleById);
router.put('/:id', protect, salesController.updateSale); // ✅ UPDATED
router.delete('/:id', protect, canEditDelete, salesController.deleteSale); // ✅ UPDATED

module.exports = router;
