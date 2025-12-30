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
} = require('../controllers/factoryController');
const { protect } = require('../middleware/auth');
const { canEditDelete } = require('../middleware/checkEditPermission'); // ✅ NEW

router.route('/').get(protect, getAllReceivings).post(protect, createReceiving);
router.route('/:id')
  .get(protect, getReceivingById)
  .put(protect, canEditDelete, updateReceiving) // ✅ UPDATED
  .delete(protect, canEditDelete, deleteReceiving); // ✅ UPDATED

router.post('/:id/return', protect, returnBorrowedStock);
router.post('/:id/mark-payment', protect, markPaymentDone);
router.get('/borrow-history/:sourceName', protect, getBorrowHistoryBySource);

module.exports = router;
