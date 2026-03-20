const mongoose = require('mongoose');

const marketplaceAccountSchema = new mongoose.Schema({
  accountName: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },

  flipkart: {
    enabled: { type: Boolean, default: false },
    appId: { type: String, default: null },
    appSecret: { type: String, default: null },
    locationId: { type: String, default: null },
    syncTime: { type: String, default: '14:00' },
    syncFrequency: {
      type: String,
      enum: ['daily', 'twice_daily'],
      default: 'daily'
    },
    secondSyncTime: { type: String, default: '20:00' },
    autoSyncEnabled: { type: Boolean, default: false },
    lastSyncAt: { type: Date, default: null },
    lastSyncStatus: {
      type: String,
      enum: ['success', 'failed', null],
      default: null
    },
    lastSyncError: { type: String, default: null }
  }
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

const sizeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    maxlength: 10
  },
  isEnabled: { type: Boolean, default: true },
  displayOrder: { type: Number, default: 0 },
  disabledForDesigns: [{ type: String }],
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
  signature: {
    image: { type: String, default: '' },
    enabledForChallans: { type: Boolean, default: false },
    enabledForBills: { type: Boolean, default: false }
  },
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
});

const salespersonPermissionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: String,
  email: String,
  maxChanges: { type: Number, min: 1 },
  isInfinite: { type: Boolean, default: false },
  timeWindowMinutes: { type: Number, required: true, min: 1 },
  permissionLevel: {
    type: String,
    enum: ['level1', 'level2', 'level3'],
    default: 'level2'
  },
  isActive: { type: Boolean, default: true },
  stats: {
    totalSessionsGranted: { type: Number, default: 0 },
    totalChangesUsed: { type: Number, default: 0 },
    averageTimeUsage: { type: Number, default: 0 },
    extensionRequests: { type: Number, default: 0 },
    extensionApprovals: { type: Number, default: 0 },
    lastSessionDate: Date
  }
});

// ─── NEW: Auto Allocation config schema ───────────────────────────────────────
const autoAllocationSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },

  // How many past days of sales to analyse for share calculation
  periodDays: { type: Number, default: 7, min: 1, max: 365 },

  // Units given to a brand-new account that has zero sales history for a variant
  newAccountInitialStock: { type: Number, default: 10, min: 0 },

  // Minimum minutes that must pass between two auto-allocations for the same variant
  // Prevents rapid re-triggers in edge cases
  rateLimitMinutes: { type: Number, default: 60, min: 1 },

  // true  → allocation runs immediately without any preview step
  // false → (reserved for future preview flow, currently always runs direct)
  directMode: { type: Boolean, default: true }
});
// ──────────────────────────────────────────────────────────────────────────────

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

  gstPercentage: { type: Number, default: 5, min: 0, max: 100 },

  sizes: {
    type: [sizeSchema],
    default: [
      { name: 'S', isEnabled: true, displayOrder: 1 },
      { name: 'M', isEnabled: true, displayOrder: 2 },
      { name: 'L', isEnabled: true, displayOrder: 3 },
      { name: 'XL', isEnabled: true, displayOrder: 4 },
      { name: 'XXL', isEnabled: true, displayOrder: 5 }
    ]
  },

  enabledSizes: {
    type: [String],
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
      { colorName: 'Black',      colorCode: '000000', isActive: true, displayOrder: 0 },
      { colorName: 'Green',      colorCode: '22c55e', isActive: true, displayOrder: 1 },
      { colorName: 'Light Grey', colorCode: 'd1d5db', isActive: true, displayOrder: 2 },
      { colorName: 'Dark Grey',  colorCode: '4b5563', isActive: true, displayOrder: 3 },
      { colorName: 'Khaki',      colorCode: 'a16207', isActive: true, displayOrder: 4 }
    ]
  },

  stockLockEnabled: { type: Boolean, default: false },
  stockLockValue:   { type: Number,  default: 0, min: 0 },
  maxStockLockThreshold: { type: Number, default: 0, min: 0 },

  editPermissions: {
    enabled: { type: Boolean, default: false },
    salespersons: { type: [salespersonPermissionSchema], default: [] },
    enableUndo: { type: Boolean, default: true },
    undoWindowSeconds: { type: Number, default: 30, min: 10, max: 300 },
    enableScreenshots: { type: Boolean, default: true },
    screenshotRetentionDays: { type: Number, default: 90, min: 30 },
    autoApproveExtensions: { type: Boolean, default: false },
    extensionAutoApproveThreshold: { type: Number, default: 0.7, min: 0, max: 1 }
  },

  companies: { type: [companySchema], default: [] },

  billingSettings: {
    autoGenerateBills:  { type: Boolean, default: true },
    billGenerationDay:  { type: Number,  default: 31 },
    paymentTermDays:    { type: Number,  default: 7 },
    defaultCompanyId:   { type: String,  default: 'company1' },
    hsnCode:            { type: String,  default: '6203' },
    gstRate:            { type: Number,  default: 5 },
    billNumberPrefix:   { type: String,  default: 'VR' }
  },

  billCounter: {
    currentFinancialYear: { type: Number, default: null },
    currentSequence:      { type: Number, default: 0 },
    lastResetDate:        { type: Date,   default: null }
  },

  flipkartSettings: {
    enabled:   { type: Boolean, default: false },
    appId:     { type: String,  default: null },
    appSecret: { type: String,  default: null },
    locationId:{ type: String,  default: null },
    autoSyncEnabled: { type: Boolean, default: false },
    syncTime:  { type: String,  default: '14:00' },
    syncFrequency: {
      type: String,
      enum: ['daily', 'twice_daily', 'custom_interval'],
      default: 'daily'
    },
    secondSyncTime: { type: String, default: '20:00' },
    lastSyncAt: { type: Date, default: null },
    lastSyncResult: {
      success:      { type: Boolean, default: null },
      totalProducts:{ type: Number,  default: 0 },
      successCount: { type: Number,  default: 0 },
      failedCount:  { type: Number,  default: 0 },
      message:      { type: String,  default: null }
    },
    accessToken:             { type: String, default: null },
    tokenExpiresAt:          { type: Date,   default: null },
    refreshToken:            { type: String, default: null },
    refreshTokenExpiresAt:   { type: Date,   default: null }
  },

  // ─── NEW: Auto Allocation Settings ────────────────────────────────────────
  autoAllocation: {
    type: autoAllocationSchema,
    default: () => ({})   // uses all field defaults defined in autoAllocationSchema
  }
  // ──────────────────────────────────────────────────────────────────────────

}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
