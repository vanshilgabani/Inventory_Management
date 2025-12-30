const express = require('express');
const router = express.Router();
const settlementController = require('../controllers/settlementController');
const { protect } = require('../middleware/auth');

// All settlement routes require authentication + admin access
router.use(protect);

// Get units preview before creating settlement
router.get('/preview-units', settlementController.getUnitsForPeriod);

// CRUD routes
router.post('/', settlementController.createSettlement);
router.get('/', settlementController.getAllSettlements);
router.get('/:id', settlementController.getSettlementById);
router.put('/:id', settlementController.updateSettlement);
router.delete('/:id', settlementController.deleteSettlement);

module.exports = router;
