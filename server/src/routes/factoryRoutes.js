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
  getBorrowHistoryBySource,
  restoreReceiving,
  getDeletedReceivings,
  permanentlyDeleteReceiving
} = require('../controllers/factoryController');
const { protect } = require('../middleware/auth');
const { canEditDelete } = require('../middleware/checkEditPermission'); // ✅ ADD THIS

// Create routes (no middleware needed)
router.post('/', protect, createReceiving);
router.post('/:id/return', protect, returnBorrowedStock);
router.post('/:id/mark-payment', protect, markPaymentDone);

router.get('/deleted/all', protect, getDeletedReceivings);        // Get all deleted
router.post('/:id/restore', protect, restoreReceiving);           // Restore deleted
router.delete('/:id/permanent', protect, permanentlyDeleteReceiving); // Permanent delete

// Read routes (no middleware needed)
router.get('/', protect, getAllReceivings);
router.get('/borrow-history/:sourceName', protect, getBorrowHistoryBySource);
router.get('/:id', protect, getReceivingById);

// ✅ UPDATE/DELETE routes - APPLY MIDDLEWARE
router.put('/:id', protect, canEditDelete, updateReceiving);
router.delete('/:id', protect, canEditDelete, deleteReceiving);

module.exports = router;
