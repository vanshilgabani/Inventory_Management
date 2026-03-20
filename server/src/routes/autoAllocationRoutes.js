const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth'); // adjust path to match your auth middleware
const {
  triggerManualAllocation,
  getNotifications,
  dismissNotification,
  dismissAllNotifications,
  streamNotifications
} = require('../controllers/autoAllocationController');

// ── Manual trigger ────────────────────────────────────────────────────────────
// POST /api/auto-allocation/run
// Body: { design, color, size } → single variant
// Body: {}                      → all variants with reserved stock > 0
router.post('/run', protect, triggerManualAllocation);
router.get('/stream', protect, streamNotifications);

// ── Fetch notifications ───────────────────────────────────────────────────────
// GET /api/auto-allocation/notifications?dismissed=false   (active — default)
// GET /api/auto-allocation/notifications?dismissed=true    (history)
router.get('/notifications', protect, getNotifications);

// ── Dismiss single notification ───────────────────────────────────────────────
// PATCH /api/auto-allocation/notifications/:id/dismiss
router.patch('/notifications/dismiss-all', protect, dismissAllNotifications); // ← must be BEFORE :id route
router.patch('/notifications/:id/dismiss', protect, dismissNotification);

module.exports = router;
