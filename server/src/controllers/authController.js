const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sendOTPEmail } = require('../utils/emailService');

// ── Helper: milliseconds until next 12 AM ──
const getExpiryUntilMidnight = () => {
  const now         = new Date();
  const nextMidnight = new Date();
  nextMidnight.setHours(0, 0, 0, 0);

  if (now >= nextMidnight) {
    nextMidnight.setDate(nextMidnight.getDate() + 1);
  }

  return Math.floor((nextMidnight - now) / 1000);
};

{/*// ⬇️ TEMPORARILY change for testing
const getExpiryUntil3AM = () => {
  return 1 * 60; // expires in 2 minutes
}; */}

// Generate JWT token
const generateToken = (id, role, email, name) => {
  return jwt.sign(
    { id, role, email, name },
    process.env.JWT_SECRET,
    { expiresIn: getExpiryUntilMidnight() } 
  );
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

// ─────────────────────────────────────────────────────
// FORGOT PASSWORD — STEP 1: Request OTP
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────────────
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Generic response — never reveal if email exists or not
    if (!user) {
      return res.status(200).json({ message: 'If this email is registered, an OTP will be sent.' });
    }

    // ── Block non-admin roles ──
    if (user.role !== 'admin') {
      return res.status(403).json({
        message: 'Password reset is not available for this account type. Please contact your administrator.',
        blocked: true,
      });
    }

    // ── Rate limit: 60s between OTP requests ──
    if (user.passwordResetOTPExpiry) {
      const otpSentAt = new Date(user.passwordResetOTPExpiry.getTime() - 10 * 60 * 1000);
      const secondsSinceSent = (Date.now() - otpSentAt.getTime()) / 1000;
      if (secondsSinceSent < 60) {
        const wait = Math.ceil(60 - secondsSinceSent);
        return res.status(429).json({ message: `Please wait ${wait} seconds before requesting a new OTP.` });
      }
    }

    // ── Generate 6-digit OTP ──
    const otp       = crypto.randomInt(100000, 999999).toString();
    const otpHashed = await bcrypt.hash(otp, 10);
    const expiry    = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await User.findByIdAndUpdate(user._id, {
      passwordResetOTP:         otpHashed,
      passwordResetOTPExpiry:   expiry,
      passwordResetOTPVerified: false,
    });

    await sendOTPEmail({ toEmail: user.email, toName: user.name, otp });

    // Mask email: ab***@gmail.com
    const masked = user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3');

    return res.status(200).json({
      message: 'OTP sent to your email address.',
      email:   masked,
    });

  } catch (error) {
    console.error('forgotPassword error:', error);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};


// ─────────────────────────────────────────────────────
// FORGOT PASSWORD — STEP 2: Verify OTP
// POST /api/auth/verify-otp
// ─────────────────────────────────────────────────────
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user || !user.passwordResetOTP) {
      return res.status(400).json({ message: 'Invalid or expired OTP. Please request a new one.' });
    }

    // ── Check expiry ──
    if (new Date() > user.passwordResetOTPExpiry) {
      await User.findByIdAndUpdate(user._id, {
        passwordResetOTP: null, passwordResetOTPExpiry: null, passwordResetOTPVerified: false,
      });
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    // ── Compare OTP ──
    const isMatch = await bcrypt.compare(otp.toString().trim(), user.passwordResetOTP);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect OTP. Please try again.' });
    }

    // ── Mark verified (keep expiry alive for step 3) ──
    await User.findByIdAndUpdate(user._id, { passwordResetOTPVerified: true });

    return res.status(200).json({ message: 'OTP verified successfully.' });

  } catch (error) {
    console.error('verifyOTP error:', error);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};


// ─────────────────────────────────────────────────────
// FORGOT PASSWORD — STEP 3: Reset Password
// POST /api/auth/reset-password
// ─────────────────────────────────────────────────────
const resetPassword = async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user || !user.passwordResetOTPVerified) {
      return res.status(400).json({ message: 'OTP not verified. Please complete OTP verification first.' });
    }

    // ── Check session hasn't expired ──
    if (!user.passwordResetOTPExpiry || new Date() > user.passwordResetOTPExpiry) {
      await User.findByIdAndUpdate(user._id, {
        passwordResetOTP: null, passwordResetOTPExpiry: null, passwordResetOTPVerified: false,
      });
      return res.status(400).json({ message: 'Session expired. Please restart the process.' });
    }

    // ── Hash and save new password ──
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await User.findByIdAndUpdate(user._id, {
      password:                 hashedPassword,
      passwordResetOTP:         null,
      passwordResetOTPExpiry:   null,
      passwordResetOTPVerified: false,
    });

    console.log(`✅ Password reset for admin: ${user.email}`);
    return res.status(200).json({ message: 'Password reset successfully. You can now log in.' });

  } catch (error) {
    console.error('resetPassword error:', error);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// ─────────────────────────────────────────────────────
// ADMIN: Reset any user's password
// PUT /api/auth/users/:id/password
// ─────────────────────────────────────────────────────
const adminResetUserPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Only allow resetting users within same organization
    if (user.organizationId.toString() !== req.organizationId.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Prevent resetting another admin's password (optional safety)
    if (user.role === 'admin' && user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Cannot reset another admin\'s password from here' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await User.findByIdAndUpdate(user._id, { password: hashedPassword });

    console.log(`✅ Admin ${req.user.email} reset password for: ${user.email}`);
    return res.status(200).json({ message: 'Password updated successfully' });

  } catch (error) {
    console.error('adminResetUserPassword error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  getAllUsers,
  updateUser,
  deleteUser,
  forgotPassword,
  verifyOTP,
  resetPassword,
  adminResetUserPassword,
};
