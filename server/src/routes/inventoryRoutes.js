const express = require('express');
const router = express.Router();
const {
  getAllProducts,
  createProduct,
  getProductById,
  updateProduct,
  deleteProduct,
  getLowStockItems,
  updateStock,
  getStockStatus,
  reduceVariantLock,
  refillVariantLock
} = require('../controllers/inventoryController');
const { protect } = require('../middleware/auth');
const { canEditDelete } = require('../middleware/checkEditPermission'); // ✅ ADD THIS

// Read routes (no middleware needed)
router.get('/', protect, getAllProducts);
router.get('/low-stock', protect, getLowStockItems);
router.get('/stock-status', protect, getStockStatus);
router.get('/:id', protect, getProductById);

// Create routes (no middleware needed - admin only handled in controller)
router.post('/', protect, createProduct);

// ✅ UPDATE/DELETE routes - APPLY MIDDLEWARE
router.put('/:id', protect, canEditDelete, updateProduct);
router.put('/:id/stock', protect, canEditDelete, updateStock);
router.delete('/:id', protect, canEditDelete, deleteProduct);

// Stock lock operations (no middleware - separate feature)
router.post('/variant-lock/reduce', protect, reduceVariantLock);
router.post('/variant-lock/refill', protect, refillVariantLock);

module.exports = router;
