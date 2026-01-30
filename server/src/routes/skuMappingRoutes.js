const express = require('express');
const router = express.Router();
const {
  getAllMappings,
  createMapping,
  deleteMapping,
  getSuggestions,
  bulkLookup
} = require('../controllers/skuMappingController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Get all mappings for tenant
router.get('/', getAllMappings);

// Get suggestions for a SKU
router.get('/suggestions', getSuggestions);

// ✅ NEW: Bulk lookup mappings
router.post('/bulk-lookup', bulkLookup);

// Create new mapping
router.post('/', createMapping);

// Delete mapping
router.delete('/:id', deleteMapping);

module.exports = router;
