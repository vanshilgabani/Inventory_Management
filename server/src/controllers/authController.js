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
      role: userRole,
      createdBy: req.user?._id,
      organizationId: organizationId,
    });

    // ✅ If this is a self-registered user (organizationId is null), set it to their own _id
    if (!organizationId) {
      user.organizationId = user._id;
      await user.save();
    }

    // ✅ AUTO-START FREE TRIAL for self-registered users only
    if (!req.user && userRole === 'admin') {
      try {
        const Subscription = require('../models/Subscription');
        const TenantSettings = require('../models/TenantSettings');
        const WholesaleBuyer = require('../models/WholesaleBuyer');
        
        const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS || '7');
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DAYS);

        // Create trial subscription
        await Subscription.create({
          userId: user._id,
          organizationId: user._id,
          planType: 'trial',
          status: 'trial',
          trialStartDate: new Date(),
          trialEndDate,
          trialOrdersUsed: 0
        });

        await TenantSettings.create({
          userId: user._id,
          organizationId: user._id,
          enabledModules: ['inventory', 'marketplace-sales'],
          inventoryMode: 'main',
          allowedSidebarItems: []
        });
        
        // ✅ Mark user as tenant (keep role as admin)
        user.isTenant = true;
        // role stays 'admin' - don't change it
        await user.save();
        
        console.log('✅ Auto-trial initialized for new user:', user.email);
        
        // ✅ Link buyer to customer if they were a wholesale buyer
        try {
          const buyerRecord = await WholesaleBuyer.findOne({
            $or: [
              { mobile: user.phone },
              { email: user.email }
            ],
            customerUserId: null  // Not already linked
          });
          
          if (buyerRecord) {
            // Link buyer to this user
            buyerRecord.customerUserId = user._id;
            buyerRecord.customerTenantId = user._id;
            buyerRecord.isCustomer = true;
            await buyerRecord.save();
            
            console.log(`✅ Linked buyer "${buyerRecord.businessName}" to customer account: ${user.email}`);
          }
        } catch (linkError) {
          console.error('⚠️  Error linking buyer to customer:', linkError.message);
          // Don't fail registration if linking fails
        }
        
      } catch (trialError) {
        console.error('⚠️ Trial auto-start failed:', trialError);
        // Continue with normal registration
      }
    }

    // Generate token
    const token = generateToken(user._id, user.role, user.email, user.name);

    res.status(201).json({
      _id: user._id,
      id: user._id,
      name: user.name,
      email: user.email,
      businessName: user.businessName,
      phone: user.phone,
      role: user.role,
      organizationId: user.organizationId,
      isTenant: user.isTenant,
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

    // ✅ FIXED: Include isSupplier and linkedSupplier
    res.json({
      _id: user._id,
      id: user._id,
      name: user.name,
      email: user.email,
      businessName: user.businessName,
      phone: user.phone,
      role: user.role,
      organizationId: user.organizationId,
      isSupplier: user.isSupplier,           // ✅ ADD THIS
      isTenant: user.isTenant,                // ✅ ADD THIS
      linkedSupplier: user.linkedSupplier,    // ✅ ADD THIS
      syncPreference: user.syncPreference,
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
    const user = await User.findById(req.user._id).select('+syncPreference');
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
    console.log('🔍 Fetching users for organization:', req.organizationId);
    
    // ✅ Explicitly select all fields except password
    const users = await User.find({
      organizationId: req.organizationId,
    })
    .select('_id name email role phone businessName isActive createdAt updatedAt organizationId createdBy')
    .sort({ createdAt: -1 })
    .lean(); // Convert to plain objects
    
    console.log('📋 Users found:', users.length);
    if (users.length > 0) {
      console.log('🔍 First user data:', JSON.stringify(users[0], null, 2));
    }
    
    res.json({ users });
  } catch (error) {
    console.error('❌ Get users error:', error);
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

    // ✅ NEW: Prevent self-deactivation
    if (user._id.toString() === req.user._id.toString() && isActive === false) {
      return res.status(400).json({ 
        message: 'You cannot deactivate your own account' 
      });
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
      id: user._id,
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
