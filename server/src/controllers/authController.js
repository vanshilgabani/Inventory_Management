const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Generate JWT token
const generateToken = (id, role, email, name) => {
  return jwt.sign({ id, role, email, name }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc Register new user
// @route POST /api/auth/register
// @access Public (first user) / Private (Admin only for additional users)
const registerUser = async (req, res) => {
  try {
    const { name, email, password, businessName, phone, role } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // ✅ FIXED: Role assignment logic
    // If req.user exists → created from User Management → 'sales' role
    // If req.user DOES NOT exist → created from Register page → 'admin' role
    let userRole;
    if (req.user) {
      // Created by admin from User Management page → SALES
      userRole = role || 'sales';
    } else {
      // Self-registered from Register page → ADMIN
      userRole = 'admin';
    }

    // ✅ Set organizationId
    // If created from register page (no req.user), they become their own admin (organizationId = null, will be set to _id after save)
    // If created from user management (req.user exists), use the creator's organizationId
    let organizationId = null;
    
    if (req.user) {
      // User created by admin from User Management
      organizationId = req.user.organizationId || req.user._id;
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      businessName,
      phone,
      role: userRole, // ✅ Use the fixed role logic
      createdBy: req.user?._id,
      organizationId: organizationId, // Will be null for self-registered users
    });

    // ✅ If this is a self-registered user (organizationId is null), set it to their own _id
    if (!organizationId) {
      user.organizationId = user._id;
      await user.save();
    }

    // Generate token
    const token = generateToken(user._id, user.role, user.email, user.name);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      businessName: user.businessName,
      phone: user.phone,
      role: user.role,
      organizationId: user.organizationId,
      token,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(400).json({ message: error.message });
  }
};

// @desc Login user
// @route POST /api/auth/login
// @access Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user and include password
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user._id, user.role, user.email, user.name);

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      businessName: user.businessName,
      phone: user.phone,
      role: user.role,
      organizationId: user.organizationId,
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Get current user
// @route GET /api/auth/me
// @access Private
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Get all users (for user management)
// @route GET /api/auth/users
// @access Private (Admin only)
const getAllUsers = async (req, res) => {
  try {
    // ✅ Only show users from the same organization
    const users = await User.find({
      organizationId: req.organizationId,
    }).select('-password').sort({ createdAt: -1 });
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Update user (for user management)
// @route PUT /api/auth/users/:id
// @access Private (Admin only)
const updateUser = async (req, res) => {
  try {
    const { name, email, role, isActive, businessName, phone } = req.body;
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // ✅ Security check - can only update users from same organization
    if (user.organizationId.toString() !== req.organizationId.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this user' });
    }

    user.name = name || user.name;
    user.email = email || user.email;
    user.role = role || user.role;
    user.isActive = isActive !== undefined ? isActive : user.isActive;
    user.businessName = businessName || user.businessName;
    user.phone = phone || user.phone;

    await user.save();

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      businessName: user.businessName,
      phone: user.phone,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc Delete user (for user management)
// @route DELETE /api/auth/users/:id
// @access Private (Admin only)
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // ✅ Security check - can only delete users from same organization
    if (user.organizationId.toString() !== req.organizationId.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this user' });
    }

    // Don't allow deleting yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    await user.deleteOne();
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  getAllUsers,
  updateUser,
  deleteUser,
};
