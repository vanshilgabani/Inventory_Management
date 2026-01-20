const express = require('express');
const router = express.Router();
const {
  getAllBills,
  getBillById,
  generateBill,
  switchCompany,
  finalizeBill,
  recordPayment,
  deleteBill,
  getBillsStats,
  customizeBill,
  getBuyerBills,
  getBuyerCurrentMonthPending,
  recordAdvancePayment,
  deleteAdvancePayment,
  recordPaymentForBill,
  getBillPaymentHistory,
  deletePaymentFromBill,
  updateBillNumber,
  splitBill
} = require('../controllers/monthlyBillController');
const { protect } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleCheck');

// All routes require authentication
router.use(protect);

// @route   GET /api/monthly-bills/stats
// @desc    Get bills statistics
// @access  Private
router.get('/stats', getBillsStats);

// @route   GET /api/monthly-bills
// @desc    Get all bills
// @access  Private
router.get('/', getAllBills);

// @route   GET /api/monthly-bills/:id
// @desc    Get single bill
// @access  Private
router.get('/:id', getBillById);

// @route   POST /api/monthly-bills/generate
// @desc    Generate new bill
// @access  Private
router.post('/generate', generateBill);

router.put('/:id/customize', protect, customizeBill);
router.put('/:id/update-bill-number', protect, updateBillNumber);
router.get('/bills/:id/payment-history', getBillPaymentHistory);

// @route   PUT /api/monthly-bills/:id/switch-company
// @desc    Switch company for draft bill
// @access  Private
router.put('/:id/switch-company', switchCompany);

// @route   PUT /api/monthly-bills/:id/finalize
// @desc    Finalize draft bill
// @access  Private
router.put('/:id/finalize', finalizeBill);

// ✅ NEW: Buyer-specific bill routes
router.get('/buyer/:id/bills', getBuyerBills);
router.get('/buyer/:id/current-month', getBuyerCurrentMonthPending);
router.post('/buyer/:id/advance-payment', recordAdvancePayment);
router.delete('/:billId/payments/:paymentIndex', protect, isAdmin, deletePaymentFromBill);
router.delete('/buyer/:id/advance-payment/:paymentId', isAdmin, deleteAdvancePayment);

// ✅ NEW: Bill payment route (replaces old recordPayment)
router.post('/:id/payment', recordPaymentForBill);

// @route   DELETE /api/monthly-bills/:id
// @desc    Delete draft bill
// @access  Private
router.delete('/:id', deleteBill);
router.post('/:id/split', protect, splitBill);

module.exports = router;
