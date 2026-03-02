const Settings = require('../models/Settings');
const Product = require('../models/Product');
const flipkartAuth = require('../utils/flipkartAuth');
const flipkartInventorySync = require('../utils/flipkartInventorySync');
const flipkartSyncJob = require('../utils/flipkartSyncJob');

// @desc Get Flipkart settings
// @route GET /api/flipkart/settings
// @access Private
const getFlipkartSettings = async (req, res) => {
  try {
    const settings = await Settings.findOne({ organizationId: req.organizationId });
    
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    // Get next scheduled sync time
    const nextSyncTime = await flipkartSyncJob.getNextSyncTime(req.organizationId);

    // Don't send sensitive credentials to frontend
    const flipkartSettings = {
      enabled: settings.flipkartSettings?.enabled || false,
      autoSyncEnabled: settings.flipkartSettings?.autoSyncEnabled || false,
      syncTime: settings.flipkartSettings?.syncTime || '14:00',
      syncFrequency: settings.flipkartSettings?.syncFrequency || 'daily',
      secondSyncTime: settings.flipkartSettings?.secondSyncTime || '20:00',
      lastSyncAt: settings.flipkartSettings?.lastSyncAt || null,
      lastSyncResult: settings.flipkartSettings?.lastSyncResult || null,
      nextSyncTime: nextSyncTime,
      hasCredentials: !!(settings.flipkartSettings?.appId && settings.flipkartSettings?.appSecret),
      hasLocationId: !!settings.flipkartSettings?.locationId,
      locationId: settings.flipkartSettings?.locationId || null,
    };

    res.json(flipkartSettings);
  } catch (error) {
    console.error('Get Flipkart settings error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Update Flipkart settings
// @route PUT /api/flipkart/settings
// @access Private (Admin only)
const updateFlipkartSettings = async (req, res) => {
  try {
    const { 
      appId, 
      appSecret, 
      locationId, 
      enabled, 
      autoSyncEnabled, 
      syncTime,
      syncFrequency,
      secondSyncTime
    } = req.body;

    let settings = await Settings.findOne({ organizationId: req.organizationId });
    
    if (!settings) {
      settings = await Settings.create({
        organizationId: req.organizationId,
        flipkartSettings: {}
      });
    }

    // Initialize flipkartSettings if it doesn't exist
    if (!settings.flipkartSettings) {
      settings.flipkartSettings = {};
    }

    // Update credentials if provided
    if (appId) settings.flipkartSettings.appId = appId;
    if (appSecret) settings.flipkartSettings.appSecret = appSecret;
    if (locationId) settings.flipkartSettings.locationId = locationId;
    
    // Update other settings
    if (typeof enabled !== 'undefined') settings.flipkartSettings.enabled = enabled;
    if (typeof autoSyncEnabled !== 'undefined') settings.flipkartSettings.autoSyncEnabled = autoSyncEnabled;
    if (syncTime) settings.flipkartSettings.syncTime = syncTime;
    if (syncFrequency) settings.flipkartSettings.syncFrequency = syncFrequency;
    if (secondSyncTime) settings.flipkartSettings.secondSyncTime = secondSyncTime;

    await settings.save();

    // Restart sync job if auto-sync is enabled
    if (settings.flipkartSettings.autoSyncEnabled && settings.flipkartSettings.enabled) {
      flipkartSyncJob.startJob(req.organizationId);
    } else {
      flipkartSyncJob.stopJob(req.organizationId);
    }

    // Get next sync time
    const nextSyncTime = await flipkartSyncJob.getNextSyncTime(req.organizationId);

    res.json({
      success: true,
      message: 'Flipkart settings updated successfully',
      settings: {
        enabled: settings.flipkartSettings.enabled,
        autoSyncEnabled: settings.flipkartSettings.autoSyncEnabled,
        syncTime: settings.flipkartSettings.syncTime,
        syncFrequency: settings.flipkartSettings.syncFrequency,
        secondSyncTime: settings.flipkartSettings.secondSyncTime,
        nextSyncTime: nextSyncTime,
        hasCredentials: !!(appId || settings.flipkartSettings.appId),
        hasLocationId: !!(locationId || settings.flipkartSettings.locationId),
      }
    });
  } catch (error) {
    console.error('Update Flipkart settings error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Test Flipkart credentials
// @route POST /api/flipkart/test-credentials
// @access Private (Admin only)
const testCredentials = async (req, res) => {
  try {
    const { appId, appSecret } = req.body;

    if (!appId || !appSecret) {
      return res.status(400).json({ message: 'App ID and App Secret are required' });
    }

    const result = await flipkartAuth.validateCredentials(appId, appSecret);

    if (result.valid) {
      res.json({ 
        success: true, 
        message: 'Credentials are valid! ✅' 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: 'Invalid credentials',
        error: result.error 
      });
    }
  } catch (error) {
    console.error('Test credentials error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// @desc Enable/disable Flipkart sync for a product
// @route PUT /api/flipkart/products/:id/toggle
// @access Private
const toggleProductSync = async (req, res) => {
  try {
    const { enabled, isListed, fsn, listingId } = req.body;

    const product = await Product.findOne({
      _id: req.params.id,
      organizationId: req.organizationId
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Initialize flipkart object if it doesn't exist
    if (!product.flipkart) {
      product.flipkart = {};
    }

    // Update Flipkart settings
    if (typeof enabled !== 'undefined') product.flipkart.enabled = enabled;
    if (typeof isListed !== 'undefined') product.flipkart.isListed = isListed;
    if (fsn) product.flipkart.fsn = fsn;
    if (listingId) product.flipkart.listingId = listingId;

    await product.save();

    res.json({
      success: true,
      message: 'Product Flipkart settings updated',
      product: {
        _id: product._id,
        design: product.design,
        flipkart: product.flipkart
      }
    });
  } catch (error) {
    console.error('Toggle product sync error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Update Flipkart mapping for a product
// @route PUT /api/flipkart/products/:id/mapping
// @access Private
const updateProductMapping = async (req, res) => {
  try {
    const { fsn, listingId, variantMappings, accountMappings } = req.body;

    const product = await Product.findOne({
      _id: req.params.id,
      organizationId: req.organizationId
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (!product.flipkart) {
      product.flipkart = {};
    }

    // ✅ NEW: Handle multi-account mappings
    if (accountMappings) {
      console.log('📦 Saving accountMappings:', JSON.stringify(accountMappings, null, 2));
      product.flipkart.accountMappings = accountMappings;
    }

    // ✅ OLD: Backward compatibility for single account
    if (fsn) product.flipkart.fsn = fsn;
    if (listingId) product.flipkart.listingId = listingId;
    if (variantMappings) product.flipkart.variantMappings = variantMappings;

    await product.save();

    console.log('✅ Product saved successfully');

    res.json({
      success: true,
      message: 'Product mapping updated',
      product
    });
  } catch (error) {
    console.error('Update product mapping error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Get all products with Flipkart sync status
// @route GET /api/flipkart/products
// @access Private
const getFlipkartProducts = async (req, res) => {
  try {
    const products = await Product.find({ organizationId: req.organizationId })
      .select('design colors flipkart createdAt updatedAt')
      .sort({ design: 1 });

    // Calculate total stock for each product
    const enrichedProducts = products.map(product => {
      let totalStock = 0;
      product.colors.forEach(color => {
        color.sizes.forEach(size => {
          totalStock += size.currentStock || 0;
        });
      });

      return {
        _id: product._id,
        design: product.design,
        totalStock,
        flipkart: product.flipkart || {
          enabled: false,
          isListed: false,
          fsn: null,
          lastSyncedAt: null,
          lastSyncStatus: null
        },
        colorCount: product.colors.length,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      };
    });

    res.json(enrichedProducts);
  } catch (error) {
    console.error('Get Flipkart products error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Manually trigger sync for all enabled products
// @route POST /api/flipkart/sync/manual
// @access Private
const manualSync = async (req, res) => {
  try {
    console.log('🔄 Manual Flipkart sync requested by user:', req.user.name);

    // Get all products enabled for sync
    const products = await flipkartInventorySync.getProductsToSync(req.organizationId);

    if (products.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No products are enabled for Flipkart sync. Please enable at least one product in Flipkart settings.' 
      });
    }

    console.log(`📦 Starting manual sync for ${products.length} products...`);

    // Run the sync
    const result = await flipkartSyncJob.runSync(req.organizationId);

    // Return detailed result
    res.json({
      success: result.success,
      message: result.success 
        ? `Successfully synced inventory to Flipkart` 
        : `Sync failed: ${result.error}`,
      details: {
        totalProducts: result.totalProducts || products.length,
        timestamp: new Date(),
        results: result.results
      }
    });
  } catch (error) {
    console.error('Manual sync error:', error);
    res.status(500).json({ 
      success: false, 
      message: `Sync failed: ${error.message}` 
    });
  }
};

// @desc Get sync status and statistics
// @route GET /api/flipkart/sync/status
// @access Private
const getSyncStatus = async (req, res) => {
  try {
    const settings = await Settings.findOne({ organizationId: req.organizationId });
    
    // Count enabled products
    const enabledCount = await Product.countDocuments({
      organizationId: req.organizationId,
      'flipkart.enabled': true,
    });

    console.log('✅ Enabled products count:', enabledCount);

    // ✅ NEW: Get inventory mode
    const TenantSettings = require('../models/TenantSettings');
    const tenantSettings = await TenantSettings.findOne({ organizationId: req.organizationId });
    const inventoryMode = tenantSettings?.inventoryMode || 'main';

    // Get next sync time
    const nextSyncTime = await flipkartSyncJob.getNextSyncTime(req.organizationId);

    res.json({
      enabled: settings?.flipkartSettings?.enabled || false,
      autoSyncEnabled: settings?.flipkartSettings?.autoSyncEnabled || false,
      syncTime: settings?.flipkartSettings?.syncTime || '14:00',
      syncFrequency: settings?.flipkartSettings?.syncFrequency || 'daily',
      nextSyncTime: nextSyncTime,
      lastSyncAt: settings?.flipkartSettings?.lastSyncAt || null,
      lastSyncResult: settings?.flipkartSettings?.lastSyncResult || null,
      productsEnabledCount: enabledCount,
      isConfigured: !!(settings?.flipkartSettings?.appId && settings?.flipkartSettings?.locationId),
      inventoryMode: inventoryMode // ✅ NEW: Include inventory mode
    });
  } catch (error) {
    console.error('Get sync status error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Get sync history/logs
// @route GET /api/flipkart/sync/history
// @access Private
const getSyncHistory = async (req, res) => {
  try {
    const products = await Product.find({
      organizationId: req.organizationId,
      'flipkart.lastSyncedAt': { $exists: true, $ne: null }
    })
    .select('design flipkart.lastSyncedAt flipkart.lastSyncStatus flipkart.lastSyncError')
    .sort({ 'flipkart.lastSyncedAt': -1 })
    .limit(50);

    const history = products.map(p => ({
      productId: p._id,
      design: p.design,
      syncedAt: p.flipkart.lastSyncedAt,
      status: p.flipkart.lastSyncStatus,
      error: p.flipkart.lastSyncError
    }));

    res.json(history);
  } catch (error) {
    console.error('Get sync history error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Bulk update Flipkart settings for multiple products
// @route POST /api/flipkart/products/bulk-update
// @access Private
const bulkUpdateProducts = async (req, res) => {
  try {
    const { productIds, enabled, isListed } = req.body;

    if (!productIds || productIds.length === 0) {
      return res.status(400).json({ message: 'Product IDs are required' });
    }

    const updateData = {};
    if (typeof enabled !== 'undefined') updateData['flipkart.enabled'] = enabled;
    if (typeof isListed !== 'undefined') updateData['flipkart.isListed'] = isListed;

    const result = await Product.updateMany(
      {
        _id: { $in: productIds },
        organizationId: req.organizationId
      },
      { $set: updateData }
    );

    res.json({
      success: true,
      message: `Updated ${result.modifiedCount} products`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getFlipkartSettings,
  updateFlipkartSettings,
  testCredentials,
  toggleProductSync,
  updateProductMapping,
  getFlipkartProducts,
  manualSync,
  getSyncStatus,
  getSyncHistory,
  bulkUpdateProducts
};
