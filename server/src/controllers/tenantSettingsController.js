// controllers/tenantSettingsController.js
const TenantSettings = require('../models/TenantSettings');
const User = require('../models/User');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

// Get tenant settings
exports.getSettings = async (req, res) => {
  try {
    const userId = req.user.id;

    let settings = await TenantSettings.findOne({ userId });

    if (!settings) {
      // Create default settings if not exists
      settings = await TenantSettings.create({
        userId,
        organizationId: req.user.organizationId || userId,
        enabledModules: ['inventory', 'marketplace-sales'],
        inventoryMode: 'reserved'
      });
    }

    res.json({
      success: true,
      data: settings
    });

  } catch (error) {
    logger.error('Get tenant settings failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings',
      error: error.message
    });
  }
};

// Update inventory mode
exports.updateInventoryMode = async (req, res) => {
  try {
    const { mode } = req.body;
    const { organizationId, id: userId } = req.user;

    if (!['main', 'reserved'].includes(mode)) {
      return res.status(400).json({
        success: false, // ✅ ADD THIS
        message: 'Invalid inventory mode. Must be "main" or "reserved"'
      });
    }

    // ✅ Use organizationId instead of tenantId
    const settings = await TenantSettings.findOneAndUpdate(
      { organizationId: organizationId },
      {
        $setOnInsert: {
          organizationId: organizationId,
          userId: userId,
          enabledModules: [],
          allowedSidebarItems: [], // ✅ ADD DEFAULT
          syncSettings: {},
          branding: {},
          restrictions: {},
          createdAt: new Date()
        },
        $set: {
          inventoryMode: mode,
          updatedAt: new Date()
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    console.log('✅ Updated inventory mode to:', mode);
    
    // ✅ RETURN CORRECT FORMAT
    res.json({
      success: true,
      data: {
        inventoryMode: settings.inventoryMode,
        allowedSidebarItems: settings.allowedSidebarItems,
        enabledModules: settings.enabledModules
      }
    });
    
  } catch (error) {
    console.error('Error updating inventory mode:', error);
    res.status(500).json({
      success: false, // ✅ ADD THIS
      message: 'Failed to update inventory mode',
      error: error.message
    });
  }
}

// Toggle feature access
exports.updateFeatureAccess = async (req, res) => {
  try {
    const { feature, enabled } = req.body;
    const tenantId = req.user.tenantId;

    const settings = await TenantSettings.findOne({ tenantId });
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    // Find existing feature
    const existingFeature = settings.enabledFeatures.find(f => f.feature === feature);
    
    if (existingFeature) {
      existingFeature.enabled = enabled;
    } else {
      settings.enabledFeatures.push({
        feature,
        enabled,
        grantedAt: new Date(),
        grantedBy: req.user._id
      });
    }

    await settings.save();

    res.json({
      message: `Feature ${feature} ${enabled ? 'enabled' : 'disabled'}`,
      settings
    });

  } catch (error) {
    console.error('Error updating feature access:', error);
    res.status(500).json({ message: 'Failed to update feature access', error: error.message });
  }
};

// Get current tenant settings for any user
exports.getMySettings = async (req, res) => {
  try {
    const { organizationId, isSupplier } = req.user;

    // ✅ Suppliers NEVER have restrictions
    if (isSupplier) {
      return res.json({
        success: true,
        data: {
          inventoryMode: 'reserved',
          allowedSidebarItems: [], // Empty = no restrictions
          enabledModules: []
        }
      });
    }

    // Try to find TenantSettings for this organization
    const settings = await TenantSettings.findOne({ organizationId });

    // ✅ If no settings exist OR allowedSidebarItems is empty → No restrictions
    if (!settings || !settings.allowedSidebarItems || settings.allowedSidebarItems.length === 0) {
      return res.json({
        success: true,
        data: {
          inventoryMode: settings?.inventoryMode || 'reserved',
          allowedSidebarItems: [], // Empty = no restrictions = show all
          enabledModules: settings?.enabledModules || []
        }
      });
    }

    // ✅ Return actual restrictions if they exist
    res.json({
      success: true,
      data: {
        inventoryMode: settings.inventoryMode || 'reserved',
        allowedSidebarItems: settings.allowedSidebarItems, // Apply restrictions
        enabledModules: settings.enabledModules || []
      }
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings',
      error: error.message
    });
  }
};

// Request feature access
exports.requestFeatureAccess = async (req, res) => {
  try {
    const userId = req.user.id;
    const { feature, reason } = req.body;

    const validFeatures = [
      'wholesale', 'direct-sales', 'monthly-bills', 'analytics',
      'factory-receiving', 'reserved-inventory', 'transfer-history',
      'notifications', 'settings', 'customers', 'deleted-orders', 'activity-audit'
    ];

    if (!validFeatures.includes(feature)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid feature name'
      });
    }

    const settings = await TenantSettings.findOne({ userId });

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Settings not found'
      });
    }

    // Check if feature already enabled
    if (settings.enabledModules.includes(feature)) {
      return res.status(400).json({
        success: false,
        message: 'Feature is already enabled'
      });
    }

    // Check if request already exists
    const existingRequest = settings.featureRequests.find(
      req => req.feature === feature && req.status === 'pending'
    );

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'Feature request already pending'
      });
    }

    settings.featureRequests.push({
      feature,
      requestedAt: new Date(),
      status: 'pending',
      reason
    });

    await settings.save();

    logger.info('Feature access requested', { userId, feature });

    // TODO: Send notification to admin

    res.json({
      success: true,
      message: 'Feature request submitted. Admin will review your request.',
      data: { feature }
    });

  } catch (error) {
    logger.error('Feature request failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to submit feature request',
      error: error.message
    });
  }
};

// ==================== ADMIN FUNCTIONS ====================

// Get all tenants (Admin only)
exports.getAllTenants = async (req, res) => {
  try {
    if (!req.user.isSupplier) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Suppliers only.'
      });
    }

    const tenants = await User.find({ isTenant: true })
      .select('name email phone businessName isTenant createdAt')
      .lean();

    // Enrich with settings and subscription data
    const enrichedTenants = await Promise.all(tenants.map(async (tenant) => {
      const settings = await TenantSettings.findOne({ userId: tenant._id }).lean();
      const subscription = await require('../models/Subscription').findOne({ userId: tenant._id }).lean();

      return {
        ...tenant,
        enabledModules: settings?.enabledModules || [],
        inventoryMode: settings?.inventoryMode || 'reserved',
        syncEnabled: settings?.syncSettings?.enabled || false,
        subscriptionPlan: subscription?.planType || 'none',
        subscriptionStatus: subscription?.status || 'none'
      };
    }));

    res.json({
      success: true,
      data: { tenants: enrichedTenants }
    });

  } catch (error) {
    logger.error('Get all tenants failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tenants',
      error: error.message
    });
  }
};

// Enable/disable feature for tenant (Admin only)
exports.toggleFeatureForTenant = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!req.user.isSupplier) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Access denied. Suppliers only.'
      });
    }

    const { tenantUserId } = req.params;
    const { feature, enable } = req.body;

    const settings = await TenantSettings.findOne({ userId: tenantUserId }).session(session);

    if (!settings) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Tenant settings not found'
      });
    }

    if (enable) {
      // Add feature if not already enabled
      if (!settings.enabledModules.includes(feature)) {
        settings.enabledModules.push(feature);
      }

      // Mark feature request as approved if exists
      const requestIndex = settings.featureRequests.findIndex(
        req => req.feature === feature && req.status === 'pending'
      );

      if (requestIndex !== -1) {
        settings.featureRequests[requestIndex].status = 'approved';
        settings.featureRequests[requestIndex].approvedBy = req.user.id;
        settings.featureRequests[requestIndex].approvedAt = new Date();
      }

    } else {
      // Remove feature
      settings.enabledModules = settings.enabledModules.filter(m => m !== feature);
    }

    await settings.save({ session });

    await session.commitTransaction();

    logger.info('Feature toggled for tenant', { tenantUserId, feature, enable });

    // TODO: Send notification to tenant

    res.json({
      success: true,
      message: `Feature ${enable ? 'enabled' : 'disabled'} successfully`,
      data: { enabledModules: settings.enabledModules }
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Toggle feature failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to toggle feature',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// Link tenant to supplier (Admin only)
exports.linkTenantToSupplier = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!req.user.isSupplier) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Access denied. Suppliers only.'
      });
    }

    const { tenantUserId } = req.params;
    const { syncEnabled = true } = req.body;
    const supplierUserId = req.user.id;

    // Update supplier's linkedTenants array
    const supplier = await User.findById(supplierUserId).session(session);
    const tenant = await User.findById(tenantUserId).session(session);

    if (!tenant) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Add to supplier's linkedTenants
    const existingLink = supplier.linkedTenants.find(
      t => t.tenantUserId.toString() === tenantUserId
    );

    if (!existingLink) {
      supplier.linkedTenants.push({
        tenantUserId: tenant._id,
        tenantName: tenant.name,
        tenantEmail: tenant.email,
        syncEnabled
      });
    } else {
      existingLink.syncEnabled = syncEnabled;
    }

    // Update tenant's linkedSupplier
    tenant.linkedSupplier = {
      supplierUserId: supplier._id,
      supplierName: supplier.name,
      supplierEmail: supplier.email,
      syncEnabled
    };

    await supplier.save({ session });
    await tenant.save({ session });

    // Update tenant settings
    await TenantSettings.findOneAndUpdate(
      { userId: tenantUserId },
      {
        'syncSettings.enabled': syncEnabled,
        'syncSettings.supplierUserId': supplierUserId,
        'syncSettings.supplierName': supplier.name
      },
      { session }
    );

    await session.commitTransaction();

    logger.info('Tenant linked to supplier', { tenantUserId, supplierUserId, syncEnabled });

    res.json({
      success: true,
      message: 'Tenant linked successfully',
      data: {
        tenantName: tenant.name,
        supplierName: supplier.name,
        syncEnabled
      }
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Link tenant failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to link tenant',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

module.exports = exports;
