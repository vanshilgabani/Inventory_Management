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
router.post('/users', protect, isAdmin, registerUser); 

// Admin only routes
router.get('/users', protect, isAdmin, getAllUsers);
router.put('/users/:id', protect, isAdmin, updateUser);
router.delete('/users/:id', protect, isAdmin, deleteUser);

module.exports = router;
