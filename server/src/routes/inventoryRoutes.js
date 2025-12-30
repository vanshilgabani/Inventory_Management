const express = require('express');
const router = express.Router();
const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getLowStockItems,
  updateStock,
  getStockStatus,
  reduceVariantLock,
  refillVariantLock,
} = require('../controllers/inventoryController');
const { protect } = require('../middleware/auth');
const { canEditDelete } = require('../middleware/checkEditPermission');

// ✅ SPECIFIC ROUTES FIRST (before /:id)
router.get('/low-stock', protect, getLowStockItems);
router.get('/stock-status', protect, getStockStatus);
router.post('/reduce-variant-lock', protect, reduceVariantLock);
router.post('/refill-variant-lock', protect, refillVariantLock);  // ✅ MOVED UP

// ✅ THEN GENERAL ROUTES
router.get('/', protect, getAllProducts);
router.post('/', protect, createProduct);

// ✅ PARAMETERIZED ROUTES LAST (after specific routes)
router.get('/:id', protect, getProductById);
router.put('/:id', protect, canEditDelete, updateProduct);
router.put('/:id/stock', protect, canEditDelete, updateStock);
router.delete('/:id', protect, canEditDelete, deleteProduct);

module.exports = router;
