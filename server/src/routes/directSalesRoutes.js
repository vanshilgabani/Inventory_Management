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
  getAllCustomers,        // ✅ ADD THIS
  getCustomerByMobile,    // ✅ ADD THIS
} = require('../controllers/directSalesController');
const { protect } = require('../middleware/auth');
const { canEditDelete } = require('../middleware/checkEditPermission');

// All routes require authentication
router.use(protect);

// ✅ Customer routes - MUST come BEFORE /:id
router.get('/customers', getAllCustomers);
router.get('/customers/:mobile', getCustomerByMobile);

// Get all direct sales
router.get('/', getAllSales);

// Get sales by date range
router.get('/date-range', getSalesByDateRange);

// Get sales by customer
router.get('/customer/:customerId', getSalesByCustomer);

// ✅ Parameterized route comes AFTER specific routes
router.get('/:id', getSaleById);

// Create new sale
router.post('/', createSale);

// Update sale
router.put('/:id', canEditDelete, updateSale);

// Delete sale
router.delete('/:id', canEditDelete, deleteSale);

module.exports = router;
