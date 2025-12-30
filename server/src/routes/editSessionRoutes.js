const express = require('express');
const router = express.Router();
const {
  startEditSession,
  getActiveSession,
  getAllActiveSessions,
  useEdit,
  endSession
} = require('../controllers/editSessionController');
const { protect } = require('../middleware/auth');

router.post('/start', protect, startEditSession);
router.get('/active', protect, getActiveSession);
router.get('/all', protect, getAllActiveSessions);
router.post('/use', protect, useEdit);
router.post('/end', protect, endSession);

module.exports = router;
