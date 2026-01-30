// models/TenantSettings.js
const mongoose = require('mongoose');

const tenantSettingsSchema = new mongoose.Schema({
  // User reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  // Enabled modules/features
  enabledModules: {
    type: [String],
    default: ['inventory', 'marketplace-sales'],
    enum: [
      'inventory',
      'marketplace-sales',
      'wholesale',
      'direct-sales',
      'monthly-bills',
      'analytics',
      'factory-receiving',
      'reserved-inventory',
      'transfer-history',
      'notifications',
      'settings',
      'customers',
      'deleted-orders',
      'activity-audit'
    ]
  },
  // NEW: Sidebar navigation control
allowedSidebarItems: {
  type: [String],
  default: [
    'dashboard',
    'inventory', 
    'marketplace-sales'
  ],
  enum: [
    'dashboard',           // Always visible
    'inventory',
    'factory-receiving',
    'received-from-supplier',
    'wholesale',
    'direct-sales',
    'marketplace-sales',
    'wholesale-buyers',
    'customers',
    'analytics',
    'monthly-bills',
    'deleted-orders',
    'users',
    'settings'            // Always visible
  ]
},

  // Inventory mode configuration
  inventoryMode: {
    type: String,
    enum: ['main', 'reserved'],
    default: 'reserved',
    description: 'Which inventory pool to use for marketplace sales'
  },

  // Wholesale order sync settings
  syncSettings: {
    enabled: { type: Boolean, default: false },
    supplierUserId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User',
      default: null
    },
    supplierName: String,
    autoAcceptOrders: { type: Boolean, default: true },
    notifyOnSync: { type: Boolean, default: true }
  },

  // Company branding
  branding: {
    companyName: String,
    logo: String,
    primaryColor: { type: String, default: '#4F46E5' }
  },

  // Restrictions
  restrictions: {
    maxUsers: { type: Number, default: 1 },
    maxOrders: { type: Number, default: null }, // null = unlimited
    maxInventoryItems: { type: Number, default: null }
  },

  // Feature request tracking
  featureRequests: [{
    feature: String,
    requestedAt: Date,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date
  }],
  
  inventoryMode: {
    type: String,
    enum: ['main', 'reserved'],
    default: 'reserved'
  },

  enabledFeatures: [{
    feature: {
      type: String,
      enum: ['inventory', 'marketplace', 'wholesale', 'direct', 'analytics', 'factory', 'reports']
    },
    enabled: {
      type: Boolean,
      default: false
    },
    grantedAt: {
      type: Date,
      default: Date.now
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // Default enabled features for new customers
  defaultEnabledFeatures: {
    type: [String],
    default: ['inventory', 'marketplace'] // Free tier features
  },

  // Usage tracking
  usageStats: {
    marketplaceOrdersThisMonth: {
      type: Number,
      default: 0
    },
    lastResetDate: {
      type: Date,
      default: Date.now
    },
    totalInventoryItems: {
      type: Number,
      default: 0
    }
  },

  // Organization
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

// Indexes
tenantSettingsSchema.index({ userId: 1 });
tenantSettingsSchema.index({ organizationId: 1 });

module.exports = mongoose.model('TenantSettings', tenantSettingsSchema);
