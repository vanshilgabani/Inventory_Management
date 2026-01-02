const express = require('express');
const router = express.Router();
const {
  getAllTransfers,
  getRecentTransfers,
  transferToReserved,
  transferToMain,
  bulkTransferToReserved,
  bulkTransferToMain  // ADD THIS
} = require('../controllers/transferController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

router.get('/', getAllTransfers);
router.get('/recent', getRecentTransfers);
router.post('/to-reserved', transferToReserved);
router.post('/to-main', transferToMain);
router.post('/bulk-to-reserved', bulkTransferToReserved);
router.post('/bulk-to-main', bulkTransferToMain);  // ADD THIS

module.exports = router;
