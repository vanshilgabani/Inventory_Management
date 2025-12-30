const express = require('express');
const router = express.Router();
const {
  getAllNotifications,
  getNotificationCount,
  getNotificationSummary,
  dismissNotification,
  snoozeNotification,
  resolveNotification,
  addContactNote,
  setPaymentPromise,
  sendBulkEmails,
  cleanupNotifications,
  sendWarningEmail
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleCheck');

// Get routes
router.get('/', protect, getAllNotifications);
router.get('/count', protect, getNotificationCount);
router.get('/summary', protect, getNotificationSummary);

// Post routes
router.post('/:id/dismiss', protect, dismissNotification);
router.post('/:id/snooze', protect, snoozeNotification);
router.post('/:id/resolve', protect, resolveNotification);
router.post('/:id/contact', protect, addContactNote);
router.post('/:id/promise', protect, setPaymentPromise);
router.post('/bulk-email', protect, sendBulkEmails);
router.post('/:id/send-email', protect, sendWarningEmail);

// Delete route (Admin only)
router.delete('/cleanup', protect, isAdmin, cleanupNotifications);

module.exports = router;
