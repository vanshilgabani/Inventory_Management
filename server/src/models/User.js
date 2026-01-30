const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 6,
    select: false,
  },
  businessName: {
    type: String,
  },
  phone: {
    type: String,
  },
  role: {
    type: String,
    enum: ['admin', 'sales', 'tenant'], // ✅ FIXED: Added 'tenant' role
    default: 'sales',
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },

  tenantId: {
    type: String,
    required: true,
    index: true,
    default: function() {
      return this._id.toString(); // Master accounts use their own ID as tenantId
    }
  },

  parentTenantId: {
    type: String,
    default: null, // Null for master accounts, set for customer accounts
    index: true
  },

  accountType: {
    type: String,
    enum: ['master', 'customer'],
    default: 'master'
  },

  // For linking to supplier (if this is a customer account)
  linkedSupplierId: {
    type: String,
    default: null // ID of the master account they buy from
  },

  companyName: {
    type: String,
    default: ''
  },

  isActive: {
    type: Boolean,
    default: true
  },

  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },

  lastLoginAt: {
    type: Date,
    default: Date.now
  },

  // Tenant-specific fields
  isTenant: { type: Boolean, default: false },
  isSupplier: { type: Boolean, default: false },

  // Linked tenant (if this user is a supplier)
  linkedTenants: [{
    tenantUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tenantName: String,
    tenantEmail: String, // ✅ ADDED: Helpful for notifications
    syncEnabled: { type: Boolean, default: true }
  }],

  // Linked supplier (if this user is a tenant)
  linkedSupplier: {
    supplierUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    supplierName: String,
    supplierEmail: String, // ✅ ADDED: Helpful for notifications
    syncEnabled: { type: Boolean, default: true }
  },

  // Multi-tenant field
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null, // null for backward compatibility
  },

  // ✅ NEW: Sync preference for wholesale orders
  syncPreference: {
    type: String,
    enum: ['direct', 'manual'],
    default: 'direct'
  },
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Method to check password (for login compatibility)
userSchema.methods.matchPassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check password (alternative name)
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
