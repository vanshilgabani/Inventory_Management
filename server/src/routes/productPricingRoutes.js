const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleCheck');
const {
  getAllPricings,
  getPricingById,
  getPricingByProductAndAccount,
  getAccountsForProduct,
  createPricing,
  updatePricing,
  deletePricing
} = require('../controllers/productPricingController');

// Get all pricings (admin only)
router.get('/', protect, isAdmin, getAllPricings);

// Get pricing by product and account (all users)
router.get('/find', protect, getPricingByProductAndAccount);

// Get accounts configured for a product (all users)
router.get('/accounts/:design', protect, getAccountsForProduct);

// Get pricing by ID (admin only)
router.get('/:id', protect, isAdmin, getPricingById);

// Create pricing (admin only)
router.post('/', protect, isAdmin, createPricing);

// Update pricing (admin only)
router.put('/:id', protect, isAdmin, updatePricing);

// Delete pricing (admin only)
router.delete('/:id', protect, isAdmin, deletePricing);

module.exports = router;
