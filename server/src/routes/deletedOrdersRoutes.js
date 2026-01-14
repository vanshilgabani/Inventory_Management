const express = require('express');
const router = express.Router();
const deletedOrdersController = require('../controllers/deletedOrdersController');

// All routes are admin-only
const { protect } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleCheck'); // ✅ ADD THIS

// Get all deleted orders (combined)
router.get('/', protect, isAdmin, deletedOrdersController.getAllDeletedOrders);

// Get deleted orders by type
router.get('/wholesale', protect, isAdmin, deletedOrdersController.getDeletedWholesaleOrders);
router.get('/direct-sales', protect, isAdmin, deletedOrdersController.getDeletedDirectSales);
router.get('/marketplace-sales', protect, isAdmin, deletedOrdersController.getDeletedMarketplaceSales);

// Restore deleted order
router.post('/restore/:type/:id', protect, isAdmin, deletedOrdersController.restoreOrder);

// Permanently delete order
router.delete('/permanent/:type/:id', protect, isAdmin, deletedOrdersController.permanentlyDeleteOrder);

module.exports = router;
