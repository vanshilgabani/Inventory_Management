const express = require('express');
const router = express.Router();
const { getCustomers, updateSidebarPermissions, updateBuyerSyncPreference, getCustomerDetails} = require('../controllers/adminController');
const { protect } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleCheck');

// Customer management
router.get('/customers', protect, isAdmin, getCustomers);
router.put('/customers/:customerId/sidebar-permissions', protect, isAdmin, updateSidebarPermissions);

router.put('/customers/:customerId/sync-preference', protect, updateBuyerSyncPreference);
router.get('/customers/:customerId/details', protect, getCustomerDetails);

module.exports = router;
