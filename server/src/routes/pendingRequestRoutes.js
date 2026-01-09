const express = require('express');
const router = express.Router();
const {
  createRequest,
  getAllPendingRequests,
  getMyRequests,
  getRequestById,
  checkConflict,
  approveRequest,
  rejectRequest,
  cancelRequest,
  getPendingCount,
} = require('../controllers/pendingRequestController');
const { protect } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleCheck');

// ========================================
// SALES USER ROUTES
// ========================================

// Create new request (Sales only)
router.post('/', protect, createRequest);

// Get my requests (Sales user's own requests)
router.get('/my-requests', protect, getMyRequests);

// Cancel my request (Sales only, own requests)
router.delete('/:id/cancel', protect, cancelRequest);

// ========================================
// ADMIN ROUTES
// ========================================

// Get all pending requests (Admin only)
router.get('/', protect, isAdmin, getAllPendingRequests);

// Get single request by ID (Admin only)
router.get('/:id', protect, isAdmin, getRequestById);

// Check for conflicts (Admin only)
router.get('/:id/check-conflict', protect, isAdmin, checkConflict);

// Approve request (Admin only)
router.post('/:id/approve', protect, isAdmin, approveRequest);

// Reject request (Admin only)
router.post('/:id/reject', protect, isAdmin, rejectRequest);

// Get pending count (Admin only - for badge)
router.get('/count/pending', protect, isAdmin, getPendingCount);

module.exports = router;
