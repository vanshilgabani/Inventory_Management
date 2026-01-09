const express = require('express');
const router = express.Router();
const {
  getAllReceivings,
  createReceiving,
  getReceivingById,
  updateReceiving,
  deleteReceiving,
  returnBorrowedStock,
  markPaymentDone,
  getBorrowHistoryBySource
} = require('../controllers/factoryController');
const { protect } = require('../middleware/auth');
const { canEditDelete } = require('../middleware/checkEditPermission'); // ✅ ADD THIS

// Create routes (no middleware needed)
router.post('/', protect, createReceiving);
router.post('/:id/return', protect, returnBorrowedStock);
router.post('/:id/mark-payment', protect, markPaymentDone);

// Read routes (no middleware needed)
router.get('/', protect, getAllReceivings);
router.get('/borrow-history/:sourceName', protect, getBorrowHistoryBySource);
router.get('/:id', protect, getReceivingById);

// ✅ UPDATE/DELETE routes - APPLY MIDDLEWARE
router.put('/:id', protect, canEditDelete, updateReceiving);
router.delete('/:id', protect, canEditDelete, deleteReceiving);

module.exports = router;
