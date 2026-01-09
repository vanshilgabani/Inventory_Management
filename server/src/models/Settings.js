const mongoose = require('mongoose');

const marketplaceAccountSchema = new mongoose.Schema({
  accountName: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
});

const stockThresholdsSchema = new mongoose.Schema({
  globalThreshold: { type: Number, default: 10, min: 0 },
  designOverrides: [{
    design: String,
    threshold: { type: Number, min: 0 }
  }]
});

const colorPaletteSchema = new mongoose.Schema({
  colorName: { type: String, required: true, trim: true },
  colorCode: { type: String, required: true, trim: true },
  availableForDesigns: [{ type: String, trim: true }],
  isActive: { type: Boolean, default: true },
  displayOrder: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const notificationsSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true },
  emailAlertsEnabled: { type: Boolean, default: true },
  warningThresholdDays: { type: Number, default: 15 },
  moderateThresholdDays: { type: Number, default: 30 },
  urgentThresholdDays: { type: Number, default: 45 },
  criticalThresholdDays: { type: Number, default: 60 },
  largeAmountThreshold: { type: Number, default: 10000 },
  creditWarningPercent: { type: Number, default: 80 },
  creditLimitBlock: { type: Boolean, default: true },
  autoEmailOn80Percent: { type: Boolean, default: true },
  autoEmailMode: {
    type: String,
    enum: ['all', 'trusted_only', 'not_trusted_only', 'none'],
    default: 'not_trusted_only'
  },
  dailySummaryEnabled: { type: Boolean, default: true },
  dailySummaryTime: { type: String, default: '09:00' },
  autoDeleteResolvedAfterDays: { type: Number, default: 90 },
  enableAutoDelete: { type: Boolean, default: false },
  autoEmailChallan: { type: Boolean, default: false }
});

const companySchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  legalName: String,
  gstin: String,
  pan: String,
  address: {
    line1: String,
    line2: String,
    city: String,
    state: String,
    pincode: String,
    stateCode: String
  },
  contact: {
    phone: String,
    email: String
  },
  bank: {
    name: String,
    accountNo: String,
    ifsc: String,
    branch: String
  },
  logo: String,
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
});

// ✅ NEW: Permission configuration per salesperson
const salespersonPermissionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: String,
  email: String,
  
  // Permission limits
  maxChanges: { type: Number, min: 1 },  // null = infinite
  isInfinite: { type: Boolean, default: false },
  timeWindowMinutes: { type: Number, required: true, min: 1 },
  
  // Permission level (Feature 5)
  permissionLevel: { 
    type: String, 
    enum: ['level1', 'level2', 'level3'],
    default: 'level2'
  },
  
  // Status
  isActive: { type: Boolean, default: true },
  
  // Stats for smart auto-approve
  stats: {
    totalSessionsGranted: { type: Number, default: 0 },
    totalChangesUsed: { type: Number, default: 0 },
    averageTimeUsage: { type: Number, default: 0 }, // 0-1 (percentage)
    extensionRequests: { type: Number, default: 0 },
    extensionApprovals: { type: Number, default: 0 },
    lastSessionDate: Date
  }
});

const settingsSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  // DEPRECATED: Keep for backward compatibility
  companyName: { type: String, default: 'My Company' },
  address: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  gstNumber: { type: String, default: '' },

  // Global settings
  gstPercentage: { type: Number, default: 5, min: 0, max: 100 },
  enabledSizes: {
    type: [String],
    enum: ['S', 'M', 'L', 'XL', 'XXL'],
    default: ['S', 'M', 'L', 'XL', 'XXL']
  },
  marketplaceAccounts: { type: [marketplaceAccountSchema], default: [] },
  stockThresholds: {
    type: stockThresholdsSchema,
    default: { globalThreshold: 10, designOverrides: [] }
  },
  notifications: { type: notificationsSchema, default: {} },
  colorPalette: {
    type: [colorPaletteSchema],
    default: [
      { colorName: 'Black', colorCode: '000000', isActive: true, displayOrder: 0 },
      { colorName: 'Green', colorCode: '22c55e', isActive: true, displayOrder: 1 },
      { colorName: 'Light Grey', colorCode: 'd1d5db', isActive: true, displayOrder: 2 },
      { colorName: 'Dark Grey', colorCode: '4b5563', isActive: true, displayOrder: 3 },
      { colorName: 'Khaki', colorCode: 'a16207', isActive: true, displayOrder: 4 }
    ]
  },

  // Stock lock
  stockLockEnabled: { type: Boolean, default: false },
  stockLockValue: { type: Number, default: 0, min: 0 },
  maxStockLockThreshold: { type: Number, default: 0, min: 0 },

  // ✅ UPDATED: Edit permissions
  editPermissions: {
    enabled: { type: Boolean, default: false },
    salespersons: { type: [salespersonPermissionSchema], default: [] },
    
    // Global settings
    enableUndo: { type: Boolean, default: true },
    undoWindowSeconds: { type: Number, default: 30, min: 10, max: 300 },
    enableScreenshots: { type: Boolean, default: true },
    screenshotRetentionDays: { type: Number, default: 90, min: 30 },
    autoApproveExtensions: { type: Boolean, default: false },
    extensionAutoApproveThreshold: { type: Number, default: 0.7, min: 0, max: 1 } // 70% usage
  },

  // Multi-company management
  companies: { type: [companySchema], default: [] },

  // Billing settings
  billingSettings: {
    autoGenerateBills: { type: Boolean, default: true },
    billGenerationDay: { type: Number, default: 31 },
    paymentTermDays: { type: Number, default: 7 },
    defaultCompanyId: { type: String, default: 'company1' },
    hsnCode: { type: String, default: '6203' },
    gstRate: { type: Number, default: 5 },
    billNumberPrefix: { type: String, default: 'VR' }
  },

  // Bill counter for financial year based numbering
  billCounter: {
    currentFinancialYear: { type: Number, default: null },
    currentSequence: { type: Number, default: 0 },
    lastResetDate: { type: Date, default: null },
  }

}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
