const mongoose = require('mongoose');

const marketplaceAccountSchema = new mongoose.Schema({
  accountName: {
    type: String,
    required: true,
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

const stockThresholdsSchema = new mongoose.Schema({
  globalThreshold: {
    type: Number,
    default: 10,
    min: 0,
  },
  designOverrides: [
    {
      design: String,
      threshold: {
        type: Number,
        min: 0,
      },
    },
  ],
});

// ✅ NEW: Color Palette Schema
const colorPaletteSchema = new mongoose.Schema({
  colorName: {
    type: String,
    required: true,
    trim: true,
  },
  colorCode: {
    type: String,
    required: true,
    trim: true,
  },
  availableForDesigns: [{
    type: String,
    trim: true,
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
  displayOrder: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const notificationsSchema = new mongoose.Schema({
  enabled: {
    type: Boolean,
    default: true,
  },
  emailAlertsEnabled: {
    type: Boolean,
    default: true,
  },
  warningThresholdDays: {
    type: Number,
    default: 15,
  },
  moderateThresholdDays: {
    type: Number,
    default: 30,
  },
  urgentThresholdDays: {
    type: Number,
    default: 45,
  },
  criticalThresholdDays: {
    type: Number,
    default: 60,
  },
  largeAmountThreshold: {
    type: Number,
    default: 10000,
  },
  creditWarningPercent: {
    type: Number,
    default: 80,
  },
  creditLimitBlock: {
    type: Boolean,
    default: true,
  },
  autoEmailOn80Percent: {
    type: Boolean,
    default: true,
  },
  autoEmailMode: {
    type: String,
    enum: ['all', 'trusted_only', 'not_trusted_only', 'none'],
    default: 'not_trusted_only',
  },
  dailySummaryEnabled: {
    type: Boolean,
    default: true,
  },
  dailySummaryTime: {
    type: String,
    default: '09:00',
  },
  autoDeleteResolvedAfterDays: {
    type: Number,
    default: 90,
  },
  enableAutoDelete: {
    type: Boolean,
    default: false,
  },
  autoEmailChallan: {
    type: Boolean,
    default: false,
  },
});

const availableSizeSchema = new mongoose.Schema({
  size: {
    type: String,
    enum: ['S', 'M', 'L', 'XL', 'XXL'],
    required: true,
  },
  enabled: {
    type: Boolean,
    default: true,
  },
  displayOrder: {
    type: Number,
    default: 0,
  },
});

const permissionsSchema = new mongoose.Schema({
  allowSalesEdit: {
    type: Boolean,
    default: false,
  },
});

const settingsSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    companyName: {
      type: String,
      default: 'My Company',
    },
    address: {
      type: String,
      default: '',
    },
    email: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      default: '',
    },
    gstNumber: {
      type: String,
      default: '',
    },
    gstPercentage: {
      type: Number,
      default: 5,
      min: 0,
      max: 100,
    },
    enabledSizes: {
      type: [String],
      enum: ['S', 'M', 'L', 'XL', 'XXL'],
      default: ['S', 'M', 'L', 'XL', 'XXL'],
    },
    availableSizes: {
      type: [availableSizeSchema],
      default: [
        { size: 'S', enabled: true, displayOrder: 0 },
        { size: 'M', enabled: true, displayOrder: 1 },
        { size: 'L', enabled: true, displayOrder: 2 },
        { size: 'XL', enabled: true, displayOrder: 3 },
        { size: 'XXL', enabled: true, displayOrder: 4 },
      ],
    },
    marketplaceAccounts: {
      type: [marketplaceAccountSchema],
      default: [],
    },
    stockThresholds: {
      type: stockThresholdsSchema,
      default: () => ({
        globalThreshold: 10,
        designOverrides: [],
      }),
    },
    notifications: {
      type: notificationsSchema,
      default: () => ({}),
    },
    permissions: {
      type: permissionsSchema,
      default: () => ({
        allowSalesEdit: false,
      }),
    },
    // ✅ NEW: Color Palette
    colorPalette: {
      type: [colorPaletteSchema],
      default: [
        { colorName: 'Black', colorCode: '#000000', availableForDesigns: [], isActive: true, displayOrder: 0 },
        { colorName: 'Green', colorCode: '#22c55e', availableForDesigns: [], isActive: true, displayOrder: 1 },
        { colorName: 'Light Grey', colorCode: '#d1d5db', availableForDesigns: [], isActive: true, displayOrder: 2 },
        { colorName: 'Dark Grey', colorCode: '#4b5563', availableForDesigns: [], isActive: true, displayOrder: 3 },
        { colorName: 'Khaki', colorCode: '#a16207', availableForDesigns: [], isActive: true, displayOrder: 4 },
      ],
    },
    // 🔒 STOCK LOCK FEATURE - EXISTING FIELDS
    stockLockEnabled: {
      type: Boolean,
      default: false,
    },
    stockLockValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxStockLockThreshold: {
      type: Number,
      default: 0,
      min: 0,
    },
    editPermissions: {
      enabled: {
        type: Boolean,
        default: false
      },
      allowedUsers: [{
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        userName: String,
        email: String
      }],
      maxChanges: {
        type: Number,
        default: 2,
        min: 1
      },
      timeWindowMinutes: {
        type: Number,
        default: 3,
        min: 1
      }
    },
  },
  {
    timestamps: true,
  }
);

// Helper method to get enabled sizes
settingsSchema.methods.getEnabledSizes = function () {
  if (this.availableSizes && this.availableSizes.length > 0) {
    return this.availableSizes
      .filter((s) => s.enabled)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((s) => s.size);
  }
  return this.enabledSizes || ['S', 'M', 'L', 'XL', 'XXL'];
};

module.exports = mongoose.model('Settings', settingsSchema);
