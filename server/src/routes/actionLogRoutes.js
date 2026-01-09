const express = require('express');
const router = express.Router();
const {
  logAction,
  getActionLogs,
  getActionLogById,
  getLogsBySalesperson,
  markAsUndone,
  cleanupOldLogs
} = require('../controllers/actionLogController');
const { protect } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleCheck');

// Log action (called by frontend after edit/delete)
router.post('/', protect, logAction);

// Get all logs (admin)
router.get('/', protect, isAdmin, getActionLogs);

// Get logs by salesperson (admin)
router.get('/salesperson/:userId', protect, isAdmin, getLogsBySalesperson);

// Get single log details
router.get('/:id', protect, isAdmin, getActionLogById);

// Mark as undone
router.put('/:id/undo', protect, markAsUndone);

// Cleanup old logs
router.delete('/cleanup', protect, isAdmin, cleanupOldLogs);

module.exports = router;
