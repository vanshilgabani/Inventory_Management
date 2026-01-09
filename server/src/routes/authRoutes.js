const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getUserProfile,
  getAllUsers,
  updateUser,
  deleteUser,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleCheck');

// Public routes
router.post('/register', registerUser); // First user auto-becomes admin
router.post('/login', loginUser);

// Protected routes
router.get('/profile', protect, getUserProfile);

// Admin only routes
router.post('/users', protect, isAdmin, registerUser); 
router.get('/users', protect, isAdmin, getAllUsers); // ✅ Use controller function
router.put('/users/:id', protect, isAdmin, updateUser);
router.delete('/users/:id', protect, isAdmin, deleteUser);

module.exports = router;
