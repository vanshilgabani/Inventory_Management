const express = require('express');
const router = express.Router();
const {
  getAllSales,
  getSaleById,
  createSale,
  updateSale,
  deleteSale,
  getSalesByDateRange,
  getSalesByCustomer,
  getAllCustomers,
  getCustomerByMobile,
  createSaleWithReservedBorrow
} = require('../controllers/directSalesController');
const { protect } = require('../middleware/auth');
const { canEditDelete } = require('../middleware/checkEditPermission'); // ✅ ADD THIS

// Create routes (no middleware needed)
router.post('/', protect, createSale);
router.post('/with-reserved-borrow', protect, createSaleWithReservedBorrow);

// Read routes (no middleware needed)
router.get('/', protect, getAllSales);
router.get('/date-range', protect, getSalesByDateRange);
router.get('/customer/:customerId', protect, getSalesByCustomer);
router.get('/customers', protect, getAllCustomers);
router.get('/customer-mobile/:mobile', protect, getCustomerByMobile);
router.get('/:id', protect, getSaleById);

// ✅ UPDATE/DELETE routes - APPLY MIDDLEWARE
router.put('/:id', protect, canEditDelete, updateSale);
router.delete('/:id', protect, canEditDelete, deleteSale);

module.exports = router;
