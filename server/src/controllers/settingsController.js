const Settings = require('../models/Settings');
const Product = require('../models/Product');

// @desc Get settings
// @route GET /api/settings
// @access Private
const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne({ organizationId: req.organizationId });

    if (!settings) {
      settings = await Settings.create({
        organizationId: req.organizationId,
        companyName: 'My Company',
        gstPercentage: 5,
        enabledSizes: ['S', 'M', 'L', 'XL', 'XXL'],
        marketplaceAccounts: [],
        stockLockEnabled: false, // 🔒 NEW
        stockLockValue: 0, // 🔒 NEW
        maxStockLockThreshold: 0,
        editPermissions: {
          enabled: false,
          salespersons: [],
          enableUndo: true,
          undoWindowSeconds: 30
        },
        notifications: {
          enabled: true,
          emailAlertsEnabled: true,
          warningThresholdDays: 15,
          moderateThresholdDays: 30,
          urgentThresholdDays: 45,
          criticalThresholdDays: 60,
          largeAmountThreshold: 10000,
          creditWarningPercent: 80,
          creditLimitBlock: true,
          autoEmailOn80Percent: true,
          autoEmailMode: 'not_trusted_only',
          dailySummaryEnabled: true,
          dailySummaryTime: '09:00',
          autoDeleteResolvedAfterDays: 90,
          enableAutoDelete: false,
          autoEmailChallan: false,
        },
      });
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Update settings
// @route PUT /api/settings
// @access Private
const updateSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne({ organizationId: req.organizationId });
    
    if (!settings) {
      settings = await Settings.create({
        ...req.body,
        organizationId: req.organizationId
      });
    } else {
      // ✅ Explicitly handle editPermissions
      if (req.body.editPermissions) {
        settings.editPermissions = {
          enabled: req.body.editPermissions.enabled || false,
          allowedUsers: req.body.editPermissions.allowedUsers || [],
          maxChanges: req.body.editPermissions.maxChanges || 2,
          timeWindowMinutes: req.body.editPermissions.timeWindowMinutes || 3
        };
      }
      
      // Handle other fields
      Object.assign(settings, req.body);
      await settings.save();
    }

    res.json(settings);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// 🔒 NEW: Reduce stock lock value (for lock override)
// @route POST /api/settings/reduce-stock-lock
// @access Private
const reduceStockLock = async (req, res) => {
  try {
    const { reduceBy } = req.body;
    const organizationId = req.organizationId;

    if (!reduceBy || reduceBy <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reduction value',
      });
    }

    const settings = await Settings.findOne({ organizationId });

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Settings not found',
      });
    }

    if (!settings.stockLockEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Stock lock is not enabled',
      });
    }

    // Calculate new lock value
    const newLockValue = Math.max(0, settings.stockLockValue - reduceBy);
    const actualReduction = settings.stockLockValue - newLockValue;

    settings.stockLockValue = newLockValue;
    await settings.save();

    res.status(200).json({
      success: true,
      message: `Stock lock reduced by ${actualReduction} units`,
      data: {
        previousLockValue: settings.stockLockValue + actualReduction,
        newLockValue: settings.stockLockValue,
        reducedBy: actualReduction,
        maxThreshold: settings.maxStockLockThreshold || 0,  // ✅ ADD THIS
      },
    });

  } catch (error) {
    console.error('Reduce stock lock error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reduce stock lock',
      error: error.message,
    });
  }
};

// ✅ NEW: Add marketplace account
// @route POST /api/settings/marketplace-accounts
// @access Private (Admin only)
const addMarketplaceAccount = async (req, res) => {
  try {
    const { accountName, isDefault } = req.body;

    if (!accountName || accountName.trim() === '') {
      return res.status(400).json({ message: 'Account name is required' });
    }

    let settings = await Settings.findOne({ organizationId: req.organizationId });

    if (!settings) {
      settings = await Settings.create({ organizationId: req.organizationId });
    }

    // Check for duplicate account name
    const isDuplicate = settings.marketplaceAccounts.some(
      (acc) => acc.accountName.toLowerCase() === accountName.trim().toLowerCase()
    );

    if (isDuplicate) {
      return res.status(400).json({ message: 'Account name already exists' });
    }

    // If this is set as default, unset all other defaults
    if (isDefault) {
      settings.marketplaceAccounts.forEach((acc) => {
        acc.isDefault = false;
      });
    }

    // Add new account
    settings.marketplaceAccounts.push({
      accountName: accountName.trim(),
      isDefault: isDefault || false,
      isActive: true,
    });

    await settings.save();

    res.status(201).json({
      message: 'Marketplace account added successfully',
      settings,
    });
  } catch (error) {
    console.error('Add marketplace account error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ NEW: Update marketplace account
// @route PUT /api/settings/marketplace-accounts/:accountId
// @access Private (Admin only)
const updateMarketplaceAccount = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { accountName, isDefault, isActive } = req.body;

    const settings = await Settings.findOne({ organizationId: req.organizationId });

    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    const account = settings.marketplaceAccounts.id(accountId);

    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    // Check for duplicate name (excluding current account)
    if (accountName && accountName.trim() !== '') {
      const isDuplicate = settings.marketplaceAccounts.some(
        (acc) =>
          acc._id.toString() !== accountId &&
          acc.accountName.toLowerCase() === accountName.trim().toLowerCase()
      );

      if (isDuplicate) {
        return res.status(400).json({ message: 'Account name already exists' });
      }

      account.accountName = accountName.trim();
    }

    // If setting as default, unset all other defaults
    if (isDefault === true) {
      settings.marketplaceAccounts.forEach((acc) => {
        acc.isDefault = false;
      });
      account.isDefault = true;
    } else if (isDefault === false) {
      account.isDefault = false;
    }

    if (isActive !== undefined) {
      account.isActive = isActive;
    }

    await settings.save();

    res.json({
      message: 'Marketplace account updated successfully',
      settings,
    });
  } catch (error) {
    console.error('Update marketplace account error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ NEW: Delete marketplace account
// @route DELETE /api/settings/marketplace-accounts/:accountId
// @access Private (Admin only)
const deleteMarketplaceAccount = async (req, res) => {
  try {
    const { accountId } = req.params;

    const settings = await Settings.findOne({ organizationId: req.organizationId });

    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    const account = settings.marketplaceAccounts.id(accountId);

    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    // Remove the account
    account.deleteOne();
    await settings.save();

    res.json({
      message: 'Marketplace account deleted successfully',
      settings,
    });
  } catch (error) {
    console.error('Delete marketplace account error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ NEW: Set default marketplace account
// @route PUT /api/settings/marketplace-accounts/:accountId/set-default
// @access Private (Admin only)
const setDefaultMarketplaceAccount = async (req, res) => {
  try {
    const { accountId } = req.params;

    const settings = await Settings.findOne({ organizationId: req.organizationId });

    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    const account = settings.marketplaceAccounts.id(accountId);

    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    // Unset all defaults
    settings.marketplaceAccounts.forEach((acc) => {
      acc.isDefault = false;
    });

    // Set this account as default
    account.isDefault = true;

    await settings.save();

    res.json({
      message: 'Default marketplace account set successfully',
      settings,
    });
  } catch (error) {
    console.error('Set default marketplace account error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ NEW: Update Stock Thresholds
// @desc Update stock threshold settings
// @route PUT /api/settings/stock-thresholds
// @access Private (Admin only)
const updateStockThresholds = async (req, res) => {
  try {
    const { globalThreshold, designOverrides } = req.body;

    let settings = await Settings.findOne({ organizationId: req.organizationId });

    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    // Initialize stockThresholds if it doesn't exist
    if (!settings.stockThresholds) {
      settings.stockThresholds = {
        globalThreshold: 10,
        designOverrides: [],
      };
    }

    // Update global threshold
    if (globalThreshold !== undefined) {
      settings.stockThresholds.globalThreshold = Number(globalThreshold);
    }

    // Update design overrides
    if (designOverrides !== undefined && Array.isArray(designOverrides)) {
      settings.stockThresholds.designOverrides = designOverrides.map((item) => ({
        design: item.design,
        threshold: Number(item.threshold),
      }));
    }

    await settings.save();

    res.json({
      message: 'Stock thresholds updated successfully',
      stockThresholds: settings.stockThresholds,
    });
  } catch (error) {
    console.error('Update stock thresholds error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ NEW: Get Stock Thresholds
// @desc Get stock threshold settings
// @route GET /api/settings/stock-thresholds
// @access Private
const getStockThresholds = async (req, res) => {
  try {
    let settings = await Settings.findOne({ organizationId: req.organizationId });

    if (!settings) {
      // Return default values if settings don't exist
      return res.json({
        globalThreshold: 10,
        designOverrides: [],
      });
    }

    res.json({
      globalThreshold: settings.stockThresholds?.globalThreshold || 10,
      designOverrides: settings.stockThresholds?.designOverrides || [],
    });
  } catch (error) {
    console.error('Get stock thresholds error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ NEW: Add Design Threshold Override
// @desc Add or update threshold for a specific design
// @route POST /api/settings/stock-thresholds/design
// @access Private (Admin only)
const addDesignThreshold = async (req, res) => {
  try {
    const { design, threshold } = req.body;

    if (!design || threshold === undefined) {
      return res.status(400).json({ message: 'Design name and threshold are required' });
    }

    let settings = await Settings.findOne({ organizationId: req.organizationId });

    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    // Initialize stockThresholds if it doesn't exist
    if (!settings.stockThresholds) {
      settings.stockThresholds = {
        globalThreshold: 10,
        designOverrides: [],
      };
    }

    // Check if design already has an override
    const existingIndex = settings.stockThresholds.designOverrides.findIndex(
      (item) => item.design === design
    );

    if (existingIndex !== -1) {
      // Update existing override
      settings.stockThresholds.designOverrides[existingIndex].threshold = Number(threshold);
    } else {
      // Add new override
      settings.stockThresholds.designOverrides.push({
        design: design,
        threshold: Number(threshold),
      });
    }

    await settings.save();

    res.json({
      message: 'Design threshold updated successfully',
      stockThresholds: settings.stockThresholds,
    });
  } catch (error) {
    console.error('Add design threshold error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ NEW: Remove Design Threshold Override
// @desc Remove threshold override for a specific design
// @route DELETE /api/settings/stock-thresholds/design/:design
// @access Private (Admin only)
const removeDesignThreshold = async (req, res) => {
  try {
    const { design } = req.params;

    let settings = await Settings.findOne({ organizationId: req.organizationId });

    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    if (!settings.stockThresholds || !settings.stockThresholds.designOverrides) {
      return res.status(404).json({ message: 'No design overrides found' });
    }

    // Remove the override
    settings.stockThresholds.designOverrides = settings.stockThresholds.designOverrides.filter(
      (item) => item.design !== design
    );

    await settings.save();

    res.json({
      message: 'Design threshold removed successfully',
      stockThresholds: settings.stockThresholds,
    });
  } catch (error) {
    console.error('Remove design threshold error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ NEW: Update Company Info
// @desc Update company information
// @route PUT /api/settings/company
// @access Private (Admin only)
const updateCompanyInfo = async (req, res) => {
  try {
    const { companyName, address, email, phone } = req.body;

    let settings = await Settings.findOne({ organizationId: req.organizationId });

    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    // Update company fields
    if (companyName !== undefined) settings.companyName = companyName;
    if (address !== undefined) settings.address = address;
    if (email !== undefined) settings.email = email;
    if (phone !== undefined) settings.phone = phone;

    await settings.save();

    res.json({
      message: 'Company information updated successfully',
      settings,
    });
  } catch (error) {
    console.error('Update company info error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ NEW: Update GST Settings
// @desc Update GST number and percentage
// @route PUT /api/settings/gst
// @access Private (Admin only)
const updateGST = async (req, res) => {
  try {
    const { gstNumber, gstPercentage } = req.body;

    let settings = await Settings.findOne({ organizationId: req.organizationId });

    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    // Update GST fields
    if (gstNumber !== undefined) settings.gstNumber = gstNumber;
    if (gstPercentage !== undefined) {
      const percentage = Number(gstPercentage);
      if (percentage < 0 || percentage > 100) {
        return res.status(400).json({ message: 'GST percentage must be between 0 and 100' });
      }
      settings.gstPercentage = percentage;
    }

    await settings.save();

    res.json({
      message: 'GST settings updated successfully',
      settings,
    });
  } catch (error) {
    console.error('Update GST error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ NEW: Update Enabled Sizes
// @desc Update enabled product sizes
// @route PUT /api/settings/sizes
// @access Private (Admin only)
const updateEnabledSizes = async (req, res) => {
  try {
    const { enabledSizes } = req.body;

    if (!Array.isArray(enabledSizes) || enabledSizes.length === 0) {
      return res.status(400).json({ message: 'Enabled sizes must be a non-empty array' });
    }

    // Validate sizes
    const validSizes = ['S', 'M', 'L', 'XL', 'XXL'];
    const invalidSizes = enabledSizes.filter((size) => !validSizes.includes(size));

    if (invalidSizes.length > 0) {
      return res.status(400).json({
        message: `Invalid sizes: ${invalidSizes.join(', ')}. Valid sizes are: ${validSizes.join(', ')}`,
      });
    }

    let settings = await Settings.findOne({ organizationId: req.organizationId });

    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    settings.enabledSizes = enabledSizes;
    await settings.save();

    res.json({
      message: 'Enabled sizes updated successfully',
      settings,
    });
  } catch (error) {
    console.error('Update enabled sizes error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ NEW: Update Permissions
// @desc Update user permissions settings
// @route PUT /api/settings/permissions
// @access Private (Admin only)
const updatePermissions = async (req, res) => {
  try {
    const { allowSalesEdit } = req.body;

    let settings = await Settings.findOne({ organizationId: req.organizationId });

    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    // Initialize permissions if it doesn't exist
    if (!settings.permissions) {
      settings.permissions = {
        allowSalesEdit: false,
      };
    }

    // Update permissions
    if (allowSalesEdit !== undefined) {
      settings.permissions.allowSalesEdit = Boolean(allowSalesEdit);
    }

    await settings.save();

    res.json({
      message: 'Permissions updated successfully',
      settings,
    });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({ message: error.message });
  }
};

const toggleStockLock = async (req, res) => {
  try {
    const { enabled, threshold } = req.body;
    const organizationId = req.organizationId;

    console.log(`📋 Toggle Stock Lock Request: enabled=${enabled}, threshold=${threshold}`);

    let settings = await Settings.findOne({ organizationId });
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    const wasEnabled = settings.stockLockEnabled;
    console.log(`📋 Was enabled before: ${wasEnabled}`);

    settings.stockLockEnabled = enabled;

    if (threshold !== undefined) {
      settings.maxStockLockThreshold = Number(threshold);
      console.log(`📋 Setting threshold to: ${threshold}`);
    }

    const Product = require('../models/Product');

    // ✅ When ENABLING: Auto-distribute threshold across variants
    if (enabled && !wasEnabled && threshold > 0) {
      console.log(`🔄 Starting auto-distribution...`);
      
      const products = await Product.find({ organizationId });
      console.log(`📦 Found ${products.length} products`);

      const allVariants = [];
      products.forEach(product => {
        product.colors.forEach(color => {
          color.sizes.forEach(size => {
            if (size.currentStock > 0) {
              allVariants.push({
                product,
                color,
                size,
                key: `${product.design}-${color.color}-${size.size}`
              });
            }
          });
        });
      });

      console.log(`📊 Found ${allVariants.length} variants with stock`);

      if (allVariants.length > 0) {
        const lockPerVariant = Math.floor(threshold / allVariants.length);
        let remaining = threshold - (lockPerVariant * allVariants.length);
        let totalLocked = 0;

        for (const variant of allVariants) {
          const lockAmount = Math.min(
            lockPerVariant + (remaining > 0 ? 1 : 0),
            variant.size.currentStock
          );
          
          variant.size.lockedStock = lockAmount;
          totalLocked += lockAmount;
          if (remaining > 0) remaining--;
          
          await variant.product.save();
        }

        console.log(`✅ Auto-locked ${totalLocked} units across ${allVariants.length} variants`);
      } else {
        console.warn(`⚠️ No variants with stock found!`);
      }
    }

    // ✅ When DISABLING: Reset all locked stock to 0
    if (!enabled && wasEnabled) {
      console.log(`🔄 Disabling stock lock, clearing all locks...`);
      
      const products = await Product.find({ organizationId });
      let totalCleared = 0;
      
      for (const product of products) {
        let modified = false;
        for (const color of product.colors) {
          for (const size of color.sizes) {
            if (size.lockedStock > 0) {
              totalCleared += size.lockedStock;
              size.lockedStock = 0;
              modified = true;
            }
          }
        }
        if (modified) await product.save();
      }
      
      console.log(`✅ Cleared ${totalCleared} units of locked stock`);
    }

    await settings.save();

    res.json({
      message: enabled 
        ? `Stock lock enabled successfully`
        : 'Stock lock disabled and all locked stock cleared.',
      settings,
    });
  } catch (error) {
    console.error('Toggle stock lock error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ CORRECTED: Distribute threshold to EACH variant (following existing code pattern)
const distributeStockLock = async (req, res) => {
  try {
    const { threshold } = req.body;
    const organizationId = req.organizationId; // ✅ Match existing pattern

    if (!threshold || threshold <= 0) {
      return res.status(400).json({ message: 'Valid threshold required' });
    }

    console.log(`🔄 Distribution for org: ${organizationId}, threshold: ${threshold}`);

    // ✅ CORRECT: Use organizationId field (not organization)
    const products = await Product.find({ organizationId });
    
    if (!products || products.length === 0) {
      return res.status(404).json({ message: 'No products found' });
    }

    console.log(`📦 Found ${products.length} products in your organization`);

    let totalDistributed = 0;
    let variantCount = 0;

    // ✅ CORRECT: Use colors[].sizes[] schema (not variants[])
    for (const product of products) {
      if (!product.colors || product.colors.length === 0) continue;

      for (const color of product.colors) {
        if (!color.sizes || color.sizes.length === 0) continue;

        for (const size of color.sizes) {
          // ✅ Apply threshold to EACH variant (not divided)
          if (size.currentStock >= threshold) {
            size.lockedStock = threshold;
            variantCount++;
            totalDistributed += threshold;
            console.log(`  ✅ ${product.design}-${color.color}-${size.size}: locked ${threshold}`);
          } else if (size.currentStock > 0) {
            size.lockedStock = size.currentStock;
            variantCount++;
            totalDistributed += size.currentStock;
            console.log(`  ⚠️ ${product.design}-${color.color}-${size.size}: locked ${size.currentStock} (partial)`);
          }
        }
      }
      
      await product.save();
    }

    console.log(`✅ Total: ${totalDistributed} units across ${variantCount} variants`);

    res.json({
      message: 'Stock lock distributed successfully',
      totalDistributed,
      variantCount,
      perVariant: threshold
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ NEW: Set Lock Amount for Specific Variant
const setVariantLockAmount = async (req, res) => {
  try {
    const { design, color, size, lockAmount } = req.body;
    const organizationId = req.organizationId;

    const settings = await Settings.findOne({ organizationId });
    if (!settings || !settings.stockLockEnabled) {
      return res.status(400).json({ 
        message: 'Stock lock feature is not enabled' 
      });
    }

    const product = await Product.findOne({ design, organizationId });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const colorVariant = product.colors.find(c => c.color === color);
    if (!colorVariant) {
      return res.status(404).json({ message: 'Color not found' });
    }

    const sizeVariant = colorVariant.sizes.find(s => s.size === size);
    if (!sizeVariant) {
      return res.status(404).json({ message: 'Size not found' });
    }

    // Validate lock amount
    if (lockAmount < 0 || lockAmount > sizeVariant.currentStock) {
      return res.status(400).json({ 
        message: `Lock amount must be between 0 and ${sizeVariant.currentStock}` 
      });
    }

    sizeVariant.lockedStock = lockAmount;
    await product.save();

    res.json({
      message: 'Lock amount set successfully',
      variant: {
        design,
        color,
        size,
        currentStock: sizeVariant.currentStock,
        lockedStock: sizeVariant.lockedStock,
        availableStock: sizeVariant.currentStock - sizeVariant.lockedStock,
      },
    });
  } catch (error) {
    console.error('Set lock amount error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ SOLUTION 2: Refill specific variant's locked stock
const refillLockedStock = async (req, res) => {
  try {
    const { design, color, size, refillAmount } = req.body;
    const organizationId = req.organizationId;

    const settings = await Settings.findOne({ organizationId });
    if (!settings || !settings.stockLockEnabled) {
      return res.status(400).json({
        message: 'Stock lock feature is not enabled'
      });
    }

    const Product = require('../models/Product');
    const product = await Product.findOne({ design, organizationId });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const colorVariant = product.colors.find(c => c.color === color);
    if (!colorVariant) {
      return res.status(404).json({ message: 'Color not found' });
    }

    const sizeVariant = colorVariant.sizes.find(s => s.size === size);
    if (!sizeVariant) {
      return res.status(404).json({ message: 'Size not found' });
    }

    const currentLocked = sizeVariant.lockedStock || 0;
    const currentStock = sizeVariant.currentStock || 0;
    const availableForLock = currentStock - currentLocked;
    const maxThreshold = settings.maxStockLockThreshold || 0;

    // Calculate how much we can actually refill
    const maxCanLock = Math.min(
      refillAmount,           // Requested amount
      availableForLock,       // Available stock
      maxThreshold - currentLocked // Don't exceed threshold
    );

    if (maxCanLock <= 0) {
      return res.status(400).json({
        message: 'Cannot refill. Either no available stock or lock is already at threshold.',
        currentStock,
        lockedStock: currentLocked,
        availableForLock,
        maxThreshold
      });
    }

    // ✅ Add to locked stock (don't change currentStock)
    sizeVariant.lockedStock = currentLocked + maxCanLock;
    await product.save();

    res.json({
      success: true,
      message: `Refilled ${maxCanLock} units to locked stock`,
      variant: {
        design,
        color,
        size,
        currentStock: sizeVariant.currentStock,
        lockedStock: sizeVariant.lockedStock,
        availableStock: sizeVariant.currentStock - sizeVariant.lockedStock,
        refilled: maxCanLock,
      },
    });
  } catch (error) {
    console.error('Refill locked stock error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ NEW: Get Stock Lock Settings with dynamic calculation
// @route GET /api/settings/stock-lock
// @access Private
const getStockLockSettings = async (req, res) => {
  try {
    const organizationId = req.organizationId;
    const settings = await Settings.findOne({ organizationId });

    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    // ✅ Calculate CURRENT locked stock from pending marketplace sales
    const MarketplaceSale = require('../models/MarketplaceSale');
    const pendingSales = await MarketplaceSale.find({
      organizationId,
      status: { $in: ['dispatched'] }
    });

    const totalLockedStock = pendingSales.reduce((sum, sale) => sum + sale.quantity, 0);

    res.json({
      stockLockEnabled: settings.stockLockEnabled || false,
      stockLockValue: totalLockedStock, // ✅ Dynamic calculation
      maxStockLockThreshold: settings.maxStockLockThreshold || 0,
    });
  } catch (error) {
    console.error('Get stock lock settings error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ NEW: Get Color Palette
// @route GET /api/settings/color-palette
// @access Private
const getColorPalette = async (req, res) => {
  try {
    const settings = await Settings.findOne({ organizationId: req.organizationId });
    
    if (!settings) {
      return res.json([
        { colorName: 'Black', colorCode: '#000000', availableForDesigns: [], isActive: true, displayOrder: 0 },
        { colorName: 'Green', colorCode: '#22c55e', availableForDesigns: [], isActive: true, displayOrder: 1 },
        { colorName: 'Light Grey', colorCode: '#d1d5db', availableForDesigns: [], isActive: true, displayOrder: 2 },
        { colorName: 'Dark Grey', colorCode: '#4b5563', availableForDesigns: [], isActive: true, displayOrder: 3 },
        { colorName: 'Khaki', colorCode: '#a16207', availableForDesigns: [], isActive: true, displayOrder: 4 },
      ]);
    }

    res.json(settings.colorPalette || []);
  } catch (error) {
    console.error('Get color palette error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ NEW: Add Color to Palette
// @route POST /api/settings/color-palette
// @access Private (Admin only)
const addColorToPalette = async (req, res) => {
  try {
    const { colorName, colorCode, availableForDesigns } = req.body;

    if (!colorName || !colorCode) {
      return res.status(400).json({ message: 'Color name and code are required' });
    }

    let settings = await Settings.findOne({ organizationId: req.organizationId });
    
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    // Check for duplicate color name
    const isDuplicate = settings.colorPalette.some(
      (c) => c.colorName.toLowerCase() === colorName.trim().toLowerCase()
    );

    if (isDuplicate) {
      return res.status(400).json({ message: 'Color name already exists' });
    }

    // Add new color
    const newColor = {
      colorName: colorName.trim(),
      colorCode: colorCode.trim(),
      availableForDesigns: availableForDesigns || [],
      isActive: true,
      displayOrder: settings.colorPalette.length,
      createdAt: new Date(),
    };

    settings.colorPalette.push(newColor);
    await settings.save();

    res.status(201).json({
      message: 'Color added successfully',
      colorPalette: settings.colorPalette,
    });
  } catch (error) {
    console.error('Add color error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ UPDATED: Update Color in Palette + Update Products
// @route PUT /api/settings/color-palette/:colorId
// @access Private (Admin only)
const updateColorInPalette = async (req, res) => {
  try {
    const { colorId } = req.params;
    const { colorName, colorCode, availableForDesigns, isActive } = req.body;
    
    const settings = await Settings.findOne({ organizationId: req.organizationId });
    
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }
    
    const color = settings.colorPalette.id(colorId);
    
    if (!color) {
      return res.status(404).json({ message: 'Color not found' });
    }
    
    // Store the old color name before updating
    const oldColorName = color.colorName;
    
    // Check for duplicate name (excluding current color)
    if (colorName && colorName.trim() !== '') {
      const isDuplicate = settings.colorPalette.some(
        (c) =>
          c._id.toString() !== colorId &&
          c.colorName.toLowerCase() === colorName.trim().toLowerCase()
      );
      
      if (isDuplicate) {
        return res.status(400).json({ message: 'Color name already exists' });
      }
      
      color.colorName = colorName.trim();
    }
    
    if (colorCode) color.colorCode = colorCode.trim();
    if (availableForDesigns !== undefined) color.availableForDesigns = availableForDesigns;
    if (isActive !== undefined) color.isActive = isActive;
    
    await settings.save();
    
    // ✅ NEW: If color name changed, update all products with old color name
    if (colorName && colorName.trim() !== '' && oldColorName !== colorName.trim()) {
      const Product = require('../models/Product');
      
      // Find all products with the old color name
      const productsToUpdate = await Product.find({
        organizationId: req.organizationId,
        'colors.color': oldColorName
      });
      
      let updatedCount = 0;
      
      // Update each product
      for (const product of productsToUpdate) {
        let modified = false;
        
        product.colors.forEach(colorVariant => {
          if (colorVariant.color === oldColorName) {
            colorVariant.color = colorName.trim();
            modified = true;
          }
        });
        
        if (modified) {
          await product.save();
          updatedCount++;
        }
      }
      
      console.log(`✅ Updated color name in ${updatedCount} products from "${oldColorName}" to "${colorName.trim()}"`);
      
      return res.json({
        message: `Color updated successfully. ${updatedCount} product(s) updated.`,
        colorPalette: settings.colorPalette,
        productsUpdated: updatedCount
      });
    }
    
    res.json({
      message: 'Color updated successfully',
      colorPalette: settings.colorPalette,
    });
    
  } catch (error) {
    console.error('Update color error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ NEW: Delete Color from Palette
// @route DELETE /api/settings/color-palette/:colorId
// @access Private (Admin only)
const deleteColorFromPalette = async (req, res) => {
  try {
    const { colorId } = req.params;

    const settings = await Settings.findOne({ organizationId: req.organizationId });
    
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    const color = settings.colorPalette.id(colorId);
    
    if (!color) {
      return res.status(404).json({ message: 'Color not found' });
    }

    // Remove the color
    color.deleteOne();
    await settings.save();

    res.json({
      message: 'Color deleted successfully',
      colorPalette: settings.colorPalette,
    });
  } catch (error) {
    console.error('Delete color error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ NEW: Reorder Colors
// @route PUT /api/settings/color-palette/reorder
// @access Private (Admin only)
const reorderColors = async (req, res) => {
  try {
    const { orderedColorIds } = req.body;

    if (!Array.isArray(orderedColorIds)) {
      return res.status(400).json({ message: 'Invalid color order array' });
    }

    const settings = await Settings.findOne({ organizationId: req.organizationId });
    
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    // Update display order
    orderedColorIds.forEach((colorId, index) => {
      const color = settings.colorPalette.id(colorId);
      if (color) {
        color.displayOrder = index;
      }
    });

    await settings.save();

    // Sort and return
    const sortedPalette = settings.colorPalette.sort((a, b) => a.displayOrder - b.displayOrder);

    res.json({
      message: 'Colors reordered successfully',
      colorPalette: sortedPalette,
    });
  } catch (error) {
    console.error('Reorder colors error:', error);
    res.status(500).json({ message: error.message });
  }
};
// ==========================================
// COMPANY MANAGEMENT FUNCTIONS - FIXED
// ==========================================

const getCompanies = async (req, res) => {
  try {
    let settings = await Settings.findOne({ organizationId: req.organizationId });
    
    console.log('🔍 getCompanies called');
    console.log('🔍 organizationId:', req.organizationId);
    console.log('🔍 settings found:', !!settings);
    
    if (!settings) {
      console.log('❌ No settings found, returning empty array');
      return res.json({ companies: [] });
    }

    console.log('🔍 settings.companies:', settings.companies);
    console.log('🔍 settings.editPermissions?.companies:', settings.editPermissions?.companies);

    // ✅ MIGRATION: Move from old location to new location
    if (settings.editPermissions?.companies?.length > 0 && (!settings.companies || settings.companies.length === 0)) {
      console.log('🔄 Migrating companies from editPermissions to root level...');
      settings.companies = settings.editPermissions.companies;
      await settings.save();
      console.log('✅ Migrated companies:', settings.companies);
    }

    const companies = settings.companies || [];
    console.log('✅ Returning companies:', companies.length, 'items');
    res.json({ companies });
  } catch (error) {
    console.error('❌ Get companies error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Add company
const addCompany = async (req, res) => {
  try {
    const { name, legalName, gstin, pan, address, contact, bank, logo, isDefault } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Company name is required' });
    }

    let settings = await Settings.findOne({ organizationId: req.organizationId });

    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    // ✅ FIX: Use settings.companies (not editPermissions.companies)
    if (!settings.companies) {
      settings.companies = [];
    }

    // Check for duplicate company name
    const isDuplicate = settings.companies.some(
      comp => comp.name.toLowerCase() === name.trim().toLowerCase()
    );

    if (isDuplicate) {
      return res.status(400).json({ message: 'Company name already exists' });
    }

    // If this is set as default, unset all other defaults
    if (isDefault) {
      settings.companies.forEach(comp => {
        comp.isDefault = false;
      });
    }

    // Generate unique company ID
    const companyId = `company${settings.companies.length + 1}`;

    // Add new company
    const newCompany = {
      id: companyId,
      name: name.trim(),
      legalName: legalName?.trim() || name.trim(),
      gstin: gstin?.trim() || '',
      pan: pan?.trim() || '',
      address: address || { line1: '', line2: '', city: '', state: 'Gujarat', pincode: '', stateCode: '24' },
      contact: contact || { phone: '', email: '' },
      bank: bank || { name: '', accountNo: '', ifsc: '', branch: '' },
      logo: logo || '',
      isDefault: isDefault || false,
      isActive: true
    };

    settings.companies.push(newCompany);

    // Also initialize billingSettings if it doesn't exist
    if (!settings.billingSettings) {
      settings.billingSettings = {
        autoGenerateBills: true,
        billGenerationDay: 31,
        paymentTermDays: 30,
        defaultCompanyId: companyId,
        hsnCode: '6203',
        gstRate: settings.gstPercentage || 5,
        billNumberPrefix: 'VR'
      };
    }

    await settings.save();

    res.status(201).json({
      message: 'Company added successfully',
      company: newCompany,
      companies: settings.companies
    });
  } catch (error) {
    console.error('Add company error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Update company
const updateCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { name, legalName, gstin, pan, address, contact, bank, logo, isDefault, isActive } = req.body;

    const settings = await Settings.findOne({ organizationId: req.organizationId });

    if (!settings || !settings.companies) {
      return res.status(404).json({ message: 'Companies not found' });
    }

    // ✅ FIX: Use settings.companies
    const company = settings.companies.find(c => c.id === companyId);

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Check for duplicate name (excluding current company)
    if (name && name.trim()) {
      const isDuplicate = settings.companies.some(
        comp => comp.id !== companyId && comp.name.toLowerCase() === name.trim().toLowerCase()
      );

      if (isDuplicate) {
        return res.status(400).json({ message: 'Company name already exists' });
      }

      company.name = name.trim();
    }

    // Update fields
    if (legalName !== undefined) company.legalName = legalName.trim();
    if (gstin !== undefined) company.gstin = gstin.trim();
    if (pan !== undefined) company.pan = pan.trim();
    if (address !== undefined) company.address = address;
    if (contact !== undefined) company.contact = contact;
    if (bank !== undefined) company.bank = bank;
    if (logo !== undefined) company.logo = logo;
    if (isActive !== undefined) company.isActive = isActive;

    // If setting as default, unset all other defaults
    if (isDefault === true) {
      settings.companies.forEach(comp => {
        comp.isDefault = false;
      });
      company.isDefault = true;
    } else if (isDefault === false) {
      company.isDefault = false;
    }

    await settings.save();

    res.json({
      message: 'Company updated successfully',
      company,
      companies: settings.companies
    });
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Delete company
const deleteCompany = async (req, res) => {
  try {
    const { companyId } = req.params;

    const settings = await Settings.findOne({ organizationId: req.organizationId });

    if (!settings || !settings.companies) {
      return res.status(404).json({ message: 'Companies not found' });
    }

    // ✅ FIX: Use settings.companies
    const companyIndex = settings.companies.findIndex(c => c.id === companyId);

    if (companyIndex === -1) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Don't allow deleting if it's the only company
    if (settings.companies.length === 1) {
      return res.status(400).json({ message: 'Cannot delete the only company' });
    }

    // Remove the company
    settings.companies.splice(companyIndex, 1);

    await settings.save();

    res.json({
      message: 'Company deleted successfully',
      companies: settings.companies
    });
  } catch (error) {
    console.error('Delete company error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Toggle company active status
const toggleCompanyActive = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { isActive } = req.body;

    const settings = await Settings.findOne({ organizationId: req.organizationId });

    if (!settings || !settings.companies) {
      return res.status(404).json({ message: 'Companies not found' });
    }

    // ✅ FIX: Use settings.companies
    const company = settings.companies.find(c => c.id === companyId);

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    company.isActive = isActive;

    await settings.save();

    res.json({
      message: `Company ${isActive ? 'activated' : 'deactivated'} successfully`,
      company,
      companies: settings.companies
    });
  } catch (error) {
    console.error('Toggle company active error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Set default company
const setDefaultCompany = async (req, res) => {
  try {
    const { companyId } = req.params;

    const settings = await Settings.findOne({ organizationId: req.organizationId });

    if (!settings || !settings.companies) {
      return res.status(404).json({ message: 'Companies not found' });
    }

    // ✅ FIX: Use settings.companies
    const company = settings.companies.find(c => c.id === companyId);

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Unset all defaults
    settings.companies.forEach(comp => {
      comp.isDefault = false;
    });

    // Set this company as default
    company.isDefault = true;

    // Also update billingSettings defaultCompanyId
    if (settings.billingSettings) {
      settings.billingSettings.defaultCompanyId = companyId;
    }

    await settings.save();

    res.json({
      message: 'Default company set successfully',
      company,
      companies: settings.companies
    });
  } catch (error) {
    console.error('Set default company error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ NEW: Update Flipkart config for a marketplace account
// @route PUT /api/settings/marketplace-accounts/:accountId/flipkart
// @access Private (Admin only)
const updateAccountFlipkart = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { enabled, appId, appSecret, locationId, syncTime, syncFrequency, secondSyncTime, autoSyncEnabled } = req.body;

    const settings = await Settings.findOne({ organizationId: req.organizationId });
    
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    const account = settings.marketplaceAccounts.id(accountId);
    
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    // Initialize flipkart object if doesn't exist
    if (!account.flipkart) {
      account.flipkart = {};
    }

    // Update Flipkart config
    account.flipkart.enabled = enabled !== undefined ? enabled : account.flipkart.enabled;
    
    if (appId !== undefined) account.flipkart.appId = appId;
    if (appSecret !== undefined) account.flipkart.appSecret = appSecret;
    if (locationId !== undefined) account.flipkart.locationId = locationId;
    if (syncTime !== undefined) account.flipkart.syncTime = syncTime;
    if (syncFrequency !== undefined) account.flipkart.syncFrequency = syncFrequency;
    if (secondSyncTime !== undefined) account.flipkart.secondSyncTime = secondSyncTime;
    if (autoSyncEnabled !== undefined) account.flipkart.autoSyncEnabled = autoSyncEnabled;

    await settings.save();

    res.json({
      success: true,
      message: 'Flipkart settings updated for account',
      account
    });
  } catch (error) {
    console.error('Update account Flipkart error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ NEW: Get all sizes (enabled + disabled)
// @route GET /api/settings/sizes
// @access Private
const getAllSizes = async (req, res) => {
  try {
    let settings = await Settings.findOne({ organizationId: req.organizationId });
    
    if (!settings) {
      // Return default sizes if settings don't exist
      return res.json([
        { name: 'S', isEnabled: true, displayOrder: 1, createdAt: new Date() },
        { name: 'M', isEnabled: true, displayOrder: 2, createdAt: new Date() },
        { name: 'L', isEnabled: true, displayOrder: 3, createdAt: new Date() },
        { name: 'XL', isEnabled: true, displayOrder: 4, createdAt: new Date() },
        { name: 'XXL', isEnabled: true, displayOrder: 5, createdAt: new Date() }
      ]);
    }

    // Check if migration needed (old enabledSizes to new sizes structure)
    if (!settings.sizes || settings.sizes.length === 0) {
      if (settings.enabledSizes && settings.enabledSizes.length > 0) {
        // Migrate old structure to new
        settings.sizes = settings.enabledSizes.map((size, index) => ({
          name: size,
          isEnabled: true,
          displayOrder: index + 1,
          createdAt: new Date()
        }));
        await settings.save();
      }
    }

    // Sort by displayOrder
    const sizes = settings.sizes.sort((a, b) => a.displayOrder - b.displayOrder);
    res.json(sizes);
  } catch (error) {
    console.error('Get all sizes error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ NEW: Get only enabled sizes (for dropdowns)
// @route GET /api/settings/sizes/enabled
// @access Private
const getEnabledSizes = async (req, res) => {
  try {
    let settings = await Settings.findOne({ organizationId: req.organizationId });
    
    if (!settings) {
      return res.json(['S', 'M', 'L', 'XL', 'XXL']);
    }

    // Check if migration needed
    if (!settings.sizes || settings.sizes.length === 0) {
      if (settings.enabledSizes && settings.enabledSizes.length > 0) {
        return res.json(settings.enabledSizes);
      }
      return res.json(['S', 'M', 'L', 'XL', 'XXL']);
    }

    // Return only enabled sizes, sorted by displayOrder
    const enabledSizes = settings.sizes
      .filter(s => s.isEnabled)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(s => s.name);
    
    res.json(enabledSizes);
  } catch (error) {
    console.error('Get enabled sizes error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ UPDATED: Add new size with AUTO-SYNC
// @route POST /api/settings/sizes
// @access Private (Admin only)
const addSize = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Size name is required' });
    }

    // Validate size name
    const sizeName = name.trim().toUpperCase();
    
    if (sizeName.length > 10) {
      return res.status(400).json({ message: 'Size name must be 10 characters or less' });
    }

    if (!/^[A-Z0-9]+$/.test(sizeName)) {
      return res.status(400).json({ message: 'Size name can only contain letters and numbers' });
    }

    let settings = await Settings.findOne({ organizationId: req.organizationId });
    
    if (!settings) {
      settings = await Settings.create({ organizationId: req.organizationId });
    }

    // Initialize sizes array if doesn't exist
    if (!settings.sizes) {
      settings.sizes = [];
    }

    // Check for duplicate (case-insensitive)
    const isDuplicate = settings.sizes.some(
      (s) => s.name.toUpperCase() === sizeName
    );

    if (isDuplicate) {
      return res.status(400).json({ message: 'Size already exists' });
    }

    // Calculate new displayOrder (highest + 1)
    const maxOrder = settings.sizes.length > 0 
      ? Math.max(...settings.sizes.map(s => s.displayOrder)) 
      : 0;

    // Add new size
    settings.sizes.push({
      name: sizeName,
      isEnabled: true,
      displayOrder: maxOrder + 1,
      createdAt: new Date()
    });

    await settings.save();

    // ✅ AUTO-SYNC: Add this new size to all existing products
    const Product = require('../models/Product');
    const products = await Product.find({ organizationId: req.organizationId });
    
    let syncedProducts = 0;
    let totalSizesAdded = 0;

    for (const product of products) {
      let productModified = false;
      
      for (const color of product.colors) {
        // Check if this color already has the new size
        const sizeExists = color.sizes.some(s => s.size === sizeName);
        
        if (!sizeExists) {
          color.sizes.push({
            size: sizeName,
            currentStock: 0,
            lockedStock: 0,
            reservedStock: 0,
            reorderPoint: 20,
            reservedAllocations: []
          });
          totalSizesAdded++;
          productModified = true;
        }
      }
      
      if (productModified) {
        await product.save();
        syncedProducts++;
      }
    }

    res.status(201).json({
      message: `Size "${sizeName}" added successfully and synced to ${syncedProducts} products`,
      size: settings.sizes[settings.sizes.length - 1],
      syncStats: {
        productsUpdated: syncedProducts,
        totalProducts: products.length,
        sizesAdded: totalSizesAdded
      }
    });
  } catch (error) {
    console.error('Add size error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ UPDATED: Toggle size with auto-sync when re-enabling
// @route PUT /api/settings/sizes/:sizeName/toggle
// @access Private (Admin only)
const toggleSize = async (req, res) => {
  try {
    const { sizeName } = req.params;
    const { isEnabled } = req.body;

    if (isEnabled === undefined) {
      return res.status(400).json({ message: 'isEnabled field is required' });
    }

    let settings = await Settings.findOne({ organizationId: req.organizationId });
    
    if (!settings || !settings.sizes) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    const size = settings.sizes.find(s => s.name.toUpperCase() === sizeName.toUpperCase());
    
    if (!size) {
      return res.status(404).json({ message: 'Size not found' });
    }

    // Check if at least one size will remain enabled
    if (!isEnabled) {
      const enabledCount = settings.sizes.filter(s => s.isEnabled).length;
      if (enabledCount === 1 && size.isEnabled) {
        return res.status(400).json({ 
          message: 'Cannot disable all sizes. At least one size must be enabled.' 
        });
      }
    }

    const wasEnabled = size.isEnabled;
    size.isEnabled = isEnabled;
    await settings.save();

    // ✅ AUTO-SYNC: If re-enabling a size, add it to products that don't have it
    let syncStats = { productsUpdated: 0, sizesAdded: 0 };
    
    if (isEnabled && !wasEnabled) {
      const Product = require('../models/Product');
      const products = await Product.find({ organizationId: req.organizationId });
      
      for (const product of products) {
        let productModified = false;
        
        for (const color of product.colors) {
          const sizeExists = color.sizes.some(s => s.size === sizeName.toUpperCase());
          
          if (!sizeExists) {
            color.sizes.push({
              size: sizeName.toUpperCase(),
              currentStock: 0,
              lockedStock: 0,
              reservedStock: 0,
              reorderPoint: 20,
              reservedAllocations: []
            });
            syncStats.sizesAdded++;
            productModified = true;
          }
        }
        
        if (productModified) {
          await product.save();
          syncStats.productsUpdated++;
        }
      }
    }

    // Check if any products use this size (warning only)
    const Product = require('../models/Product');
    const productsUsingSize = await Product.countDocuments({
      organizationId: req.organizationId,
      'colors.sizes.size': sizeName.toUpperCase()
    });

    const response = {
      message: `Size ${isEnabled ? 'enabled' : 'disabled'} successfully`,
      size: size,
      warning: !isEnabled && productsUsingSize > 0 
        ? `${productsUsingSize} product(s) currently use this size. Existing data will be preserved but hidden from new entries.`
        : null
    };

    if (syncStats.productsUpdated > 0) {
      response.syncStats = syncStats;
      response.message += ` and synced to ${syncStats.productsUpdated} products`;
    }

    res.json(response);
  } catch (error) {
    console.error('Toggle size error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ NEW: Manual sync endpoint (for existing products)
// @route POST /api/settings/sizes/sync-products
// @access Private (Admin only)
const syncProductsWithSizes = async (req, res) => {
  try {
    const settings = await Settings.findOne({ organizationId: req.organizationId });
    
    if (!settings || !settings.sizes) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    // Get all enabled sizes
    const enabledSizes = settings.sizes
      .filter(s => s.isEnabled)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(s => s.name);

    if (enabledSizes.length === 0) {
      return res.status(400).json({ message: 'No enabled sizes found' });
    }

    const Product = require('../models/Product');
    const products = await Product.find({ organizationId: req.organizationId });

    let updatedCount = 0;
    let addedSizesCount = 0;
    let removedSizesCount = 0;

    for (const product of products) {
      let productModified = false;

      for (const color of product.colors) {
        const existingSizes = color.sizes.map(s => s.size);
        
        // Add missing enabled sizes
        const missingSizes = enabledSizes.filter(size => !existingSizes.includes(size));

        if (missingSizes.length > 0) {
          missingSizes.forEach(size => {
            color.sizes.push({
              size: size,
              currentStock: 0,
              lockedStock: 0,
              reservedStock: 0,
              reorderPoint: 20,
              reservedAllocations: []
            });
            addedSizesCount++;
          });
          productModified = true;
        }

        // Optional: Remove disabled sizes (commented out to preserve historical data)
        // const disabledSizes = existingSizes.filter(size => !enabledSizes.includes(size));
        // if (disabledSizes.length > 0) {
        //   color.sizes = color.sizes.filter(s => enabledSizes.includes(s.size));
        //   removedSizesCount += disabledSizes.length;
        //   productModified = true;
        // }
      }

      if (productModified) {
        await product.save();
        updatedCount++;
      }
    }

    res.json({
      success: true,
      message: `Successfully synced ${updatedCount} products with current size configuration`,
      stats: {
        totalProducts: products.length,
        productsUpdated: updatedCount,
        sizesAdded: addedSizesCount,
        sizesRemoved: removedSizesCount,
        enabledSizes: enabledSizes
      }
    });
  } catch (error) {
    console.error('Sync products with sizes error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// ✅ NEW: Reorder sizes
// @route PUT /api/settings/sizes/reorder
// @access Private (Admin only)
const reorderSizes = async (req, res) => {
  try {
    const { sizes } = req.body; // Array of {name, displayOrder}

    if (!Array.isArray(sizes) || sizes.length === 0) {
      return res.status(400).json({ message: 'Sizes array is required' });
    }

    let settings = await Settings.findOne({ organizationId: req.organizationId });
    
    if (!settings || !settings.sizes) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    // Update displayOrder for each size
    sizes.forEach(({ name, displayOrder }) => {
      const size = settings.sizes.find(s => s.name.toUpperCase() === name.toUpperCase());
      if (size) {
        size.displayOrder = displayOrder;
      }
    });

    await settings.save();

    res.json({
      message: 'Sizes reordered successfully',
      sizes: settings.sizes.sort((a, b) => a.displayOrder - b.displayOrder)
    });
  } catch (error) {
    console.error('Reorder sizes error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getSettings,
  updateSettings,
  reduceStockLock, 
  addMarketplaceAccount,
  updateMarketplaceAccount,
  deleteMarketplaceAccount,
  setDefaultMarketplaceAccount,
  updateStockThresholds,
  getStockThresholds,
  addDesignThreshold,
  removeDesignThreshold,
  updateCompanyInfo,
  updateGST,
  updateEnabledSizes,
  updatePermissions,
  toggleStockLock,          
  setVariantLockAmount,     
  refillLockedStock,
  getStockLockSettings,
  distributeStockLock,
  getColorPalette,
  addColorToPalette,
  updateColorInPalette,
  deleteColorFromPalette,
  reorderColors,
  getCompanies,
  addCompany,
  updateCompany,
  deleteCompany,
  toggleCompanyActive,
  setDefaultCompany,
  updateAccountFlipkart,
  getAllSizes,
  getEnabledSizes,
  addSize,
  toggleSize,
  reorderSizes,
  syncProductsWithSizes
};
