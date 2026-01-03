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
  customizeBill
} = require('../controllers/monthlyBillController');
const { protect } = require('../middleware/auth');

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
// @route   PUT /api/monthly-bills/:id/switch-company
// @desc    Switch company for draft bill
// @access  Private
router.put('/:id/switch-company', switchCompany);

// @route   PUT /api/monthly-bills/:id/finalize
// @desc    Finalize draft bill
// @access  Private
router.put('/:id/finalize', finalizeBill);

// @route   POST /api/monthly-bills/:id/payment
// @desc    Record payment against bill
// @access  Private
router.post('/:id/payment', recordPayment);

// @route   DELETE /api/monthly-bills/:id
// @desc    Delete draft bill
// @access  Private
router.delete('/:id', deleteBill);

module.exports = router;
