// controllers/syncController.js
const SyncLog = require('../models/SyncLog');
const FactoryReceiving = require('../models/FactoryReceiving');
const Product = require('../models/Product');
const WholesaleOrder = require('../models/WholesaleOrder');
const User = require('../models/User');
const TenantSettings = require('../models/TenantSettings');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// ==================== SYNC ORDER TO TENANT ====================

// Sync wholesale order to tenant's inventory (called after order creation)
exports.syncOrderToTenant = async (wholesaleOrderId, action = 'create') => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Get the wholesale order
    const order = await WholesaleOrder.findById(wholesaleOrderId)
      .populate('buyerId')
      .session(session);

    if (!order) {
      logger.error('Wholesale order not found for sync', { wholesaleOrderId });
      return { success: false, error: 'Order not found' };
    }

    // Get buyer's user account (tenant)
    const buyer = order.buyerId;
    const tenantUser = await User.findOne({ 
      $or: [
        { phone: buyer.mobile },
        { email: buyer.email }
      ],
      isTenant: true
    }).session(session);

    if (!tenantUser) {
      logger.info('No tenant account found for buyer - sync skipped', { 
        buyerMobile: buyer.mobile 
      });
      return { success: false, error: 'No tenant account' };
    }

    // Check if sync is enabled for this tenant
    const tenantSettings = await TenantSettings.findOne({ 
      userId: tenantUser._id 
    }).session(session);

    if (!tenantSettings?.syncSettings?.enabled) {
      logger.info('Sync disabled for tenant', { tenantUserId: tenantUser._id });
      return { success: false, error: 'Sync disabled' };
    }

    // Check if within 24 hours (for edits/deletes)
    const orderAge = Date.now() - new Date(order.createdAt).getTime();
    const within24Hours = orderAge <= 24 * 60 * 60 * 1000;

    if (action !== 'create' && !within24Hours) {
      logger.warn('Sync attempted after 24-hour window', { 
        wholesaleOrderId, 
        action, 
        orderAge 
      });
      return { success: false, error: 'Outside 24-hour edit window' };
    }

    // Create Factory Receiving record in tenant's system
    let factoryReceiving;

    if (action === 'create') {
      // CREATE: Add items to tenant's inventory
      factoryReceiving = await FactoryReceiving.create([{
        receivedFrom: 'Supplier',
        supplierName: tenantSettings.syncSettings.supplierName || 'Veeraa Impex',
        challanNumber: order.challanNumber,
        receivedDate: order.createdAt,
        items: order.items.map(item => ({
          design: item.design,
          color: item.color,
          size: item.size,
          quantity: item.quantity,
          pricePerUnit: item.pricePerUnit
        })),
        totalQuantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
        totalAmount: order.totalAmount,
        notes: `Auto-synced from wholesale order ${order.challanNumber}`,
        syncSource: 'wholesale-order',
        syncOrderId: order._id,
        organizationId: tenantUser.organizationId || tenantUser._id,
        receivedBy: {
          userId: tenantUser._id,
          userName: tenantUser.name,
          userRole: 'tenant'
        }
      }], { session });

      // Add items to tenant's inventory
      for (const item of order.items) {
        let product = await Product.findOne({ 
          design: item.design,
          organizationId: tenantUser.organizationId || tenantUser._id
        }).session(session);

        if (!product) {
          // Create product if doesn't exist
          product = await Product.create([{
            design: item.design,
            colors: [{
              color: item.color,
              sizes: [{
                size: item.size,
                currentStock: item.quantity,
                reservedStock: 0
              }]
            }],
            organizationId: tenantUser.organizationId || tenantUser._id
          }], { session });
          product = product[0];
        } else {
          // Update existing product
          let colorVariant = product.colors.find(c => c.color === item.color);

          if (!colorVariant) {
            product.colors.push({
              color: item.color,
              sizes: [{
                size: item.size,
                currentStock: item.quantity,
                reservedStock: 0
              }]
            });
          } else {
            let sizeIndex = colorVariant.sizes.findIndex(s => s.size === item.size);

            if (sizeIndex === -1) {
              colorVariant.sizes.push({
                size: item.size,
                currentStock: item.quantity,
                reservedStock: 0
              });
            } else {
              // Add to existing stock (main inventory)
              colorVariant.sizes[sizeIndex].currentStock += item.quantity;
            }
          }

          await product.save({ session });
        }
      }

      logger.info('Order synced to tenant - CREATE', { 
        wholesaleOrderId, 
        tenantUserId: tenantUser._id,
        factoryReceivingId: factoryReceiving[0]._id
      });

    } else if (action === 'update') {
      // UPDATE: Find existing sync log and factory receiving
      const existingSyncLog = await SyncLog.findOne({
        supplierOrderId: wholesaleOrderId,
        tenantUserId: tenantUser._id,
        action: { $in: ['create', 'update'] }
      }).session(session).sort({ createdAt: -1 });

      if (!existingSyncLog || !existingSyncLog.tenantFactoryReceivingId) {
        logger.warn('No existing sync found for update', { wholesaleOrderId });
        return { success: false, error: 'No existing sync' };
      }

      const existingFactoryReceiving = await FactoryReceiving.findById(
        existingSyncLog.tenantFactoryReceivingId
      ).session(session);

      if (!existingFactoryReceiving) {
        logger.error('Factory receiving record not found', { 
          factoryReceivingId: existingSyncLog.tenantFactoryReceivingId 
        });
        return { success: false, error: 'Factory receiving not found' };
      }

      // Restore old stock (remove old items from inventory)
      for (const oldItem of existingFactoryReceiving.items) {
        const product = await Product.findOne({
          design: oldItem.design,
          organizationId: tenantUser.organizationId || tenantUser._id
        }).session(session);

        if (product) {
          const colorVariant = product.colors.find(c => c.color === oldItem.color);
          if (colorVariant) {
            const sizeIndex = colorVariant.sizes.findIndex(s => s.size === oldItem.size);
            if (sizeIndex !== -1) {
              colorVariant.sizes[sizeIndex].currentStock -= oldItem.quantity;
              colorVariant.sizes[sizeIndex].currentStock = Math.max(0, colorVariant.sizes[sizeIndex].currentStock);
            }
          }
          await product.save({ session });
        }
      }

      // Update factory receiving with new items
      existingFactoryReceiving.items = order.items.map(item => ({
        design: item.design,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        pricePerUnit: item.pricePerUnit
      }));
      existingFactoryReceiving.totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
      existingFactoryReceiving.totalAmount = order.totalAmount;
      existingFactoryReceiving.notes = `Updated from wholesale order ${order.challanNumber} (Auto-synced)`;
      existingFactoryReceiving.updatedAt = new Date();

      await existingFactoryReceiving.save({ session });

      // Add new items to inventory
      for (const item of order.items) {
        const product = await Product.findOne({
          design: item.design,
          organizationId: tenantUser.organizationId || tenantUser._id
        }).session(session);

        if (product) {
          const colorVariant = product.colors.find(c => c.color === item.color);
          if (colorVariant) {
            const sizeIndex = colorVariant.sizes.findIndex(s => s.size === item.size);
            if (sizeIndex !== -1) {
              colorVariant.sizes[sizeIndex].currentStock += item.quantity;
            }
          }
          await product.save({ session });
        }
      }

      factoryReceiving = [existingFactoryReceiving];

      logger.info('Order synced to tenant - UPDATE', { 
        wholesaleOrderId, 
        tenantUserId: tenantUser._id,
        factoryReceivingId: existingFactoryReceiving._id
      });

    } else if (action === 'delete') {
      // DELETE: Remove items from tenant's inventory
      const existingSyncLog = await SyncLog.findOne({
        supplierOrderId: wholesaleOrderId,
        tenantUserId: tenantUser._id,
        action: { $in: ['create', 'update'] }
      }).session(session).sort({ createdAt: -1 });

      if (!existingSyncLog || !existingSyncLog.tenantFactoryReceivingId) {
        logger.warn('No existing sync found for delete', { wholesaleOrderId });
        return { success: false, error: 'No existing sync' };
      }

      const existingFactoryReceiving = await FactoryReceiving.findById(
        existingSyncLog.tenantFactoryReceivingId
      ).session(session);

      if (existingFactoryReceiving) {
        // Remove items from inventory
        for (const item of existingFactoryReceiving.items) {
          const product = await Product.findOne({
            design: item.design,
            organizationId: tenantUser.organizationId || tenantUser._id
          }).session(session);

          if (product) {
            const colorVariant = product.colors.find(c => c.color === item.color);
            if (colorVariant) {
              const sizeIndex = colorVariant.sizes.findIndex(s => s.size === item.size);
              if (sizeIndex !== -1) {
                colorVariant.sizes[sizeIndex].currentStock -= item.quantity;
                colorVariant.sizes[sizeIndex].currentStock = Math.max(0, colorVariant.sizes[sizeIndex].currentStock);
              }
            }
            await product.save({ session });
          }
        }

        // Mark factory receiving as deleted
        existingFactoryReceiving.notes = `Deleted - Original wholesale order ${order.challanNumber} was removed (Auto-synced)`;
        existingFactoryReceiving.isDeleted = true;
        existingFactoryReceiving.deletedAt = new Date();
        await existingFactoryReceiving.save({ session });
      }

      logger.info('Order synced to tenant - DELETE', { 
        wholesaleOrderId, 
        tenantUserId: tenantUser._id
      });
    }

    // Create sync log
    const syncLog = await SyncLog.create([{
      supplierOrderId: order._id,
      supplierChallanNumber: order.challanNumber,
      tenantUserId: tenantUser._id,
      tenantOrganizationId: tenantUser.organizationId || tenantUser._id,
      tenantFactoryReceivingId: factoryReceiving?.[0]?._id || null,
      action,
      status: 'completed',
      itemsSynced: order.items.map(item => ({
        design: item.design,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        pricePerUnit: item.pricePerUnit
      })),
      orderDetails: {
        challanNumber: order.challanNumber,
        orderDate: order.createdAt,
        totalAmount: order.totalAmount,
        subtotal: order.subtotalAmount,
        gstAmount: order.gstAmount
      },
      syncedAt: new Date(),
      syncedWithin24Hours: within24Hours,
      organizationId: order.organizationId
    }], { session });

    // Create notification for tenant
    await Notification.create([{
      userId: tenantUser._id,
      type: 'sync',
      category: 'wholesale-sync',
      title: action === 'create' 
        ? 'New Stock Received' 
        : action === 'update' 
        ? 'Stock Updated' 
        : 'Stock Removed',
      message: action === 'create'
        ? `${order.items.reduce((sum, item) => sum + item.quantity, 0)} items received from ${tenantSettings.syncSettings.supplierName || 'supplier'}. Challan: ${order.challanNumber}`
        : action === 'update'
        ? `Stock updated for challan ${order.challanNumber}. Please review.`
        : `Stock removed for challan ${order.challanNumber}.`,
      data: {
        syncLogId: syncLog[0]._id,
        orderId: order._id,
        challanNumber: order.challanNumber,
        action
      },
      priority: 'medium',
      read: false,
      organizationId: tenantUser.organizationId || tenantUser._id
    }], { session });

    await session.commitTransaction();

    return { 
      success: true, 
      syncLogId: syncLog[0]._id,
      factoryReceivingId: factoryReceiving?.[0]?._id
    };

  } catch (error) {
    await session.abortTransaction();
    logger.error('Order sync to tenant failed', { 
      wholesaleOrderId, 
      action, 
      error: error.message 
    });
    
    // Create failed sync log
    try {
      await SyncLog.create({
        supplierOrderId: wholesaleOrderId,
        action,
        status: 'failed',
        error: error.message,
        syncedAt: new Date()
      });
    } catch (logError) {
      logger.error('Failed to create error sync log', { error: logError.message });
    }

    return { success: false, error: error.message };
  } finally {
    session.endSession();
  }
};

// ==================== TENANT SYNC LOGS ====================

// Get sync logs for tenant (tenant view)
exports.getTenantSyncLogs = async (req, res) => {
  try {
    const tenantUserId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;

    const filter = { tenantUserId };
    if (status) filter.status = status;

    const syncLogs = await SyncLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    const total = await SyncLog.countDocuments(filter);

    res.json({
      success: true,
      data: {
        syncLogs,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    logger.error('Get tenant sync logs failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sync logs',
      error: error.message
    });
  }
};

// Accept synced order (tenant confirms receipt)
exports.acceptSyncedOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { syncLogId } = req.params;
    const tenantUserId = req.user.id;

    const syncLog = await SyncLog.findOne({
      _id: syncLogId,
      tenantUserId
    }).session(session);

    if (!syncLog) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Sync log not found'
      });
    }

    if (syncLog.tenantResponse.accepted !== null) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Already responded to this sync'
      });
    }

    syncLog.tenantResponse.accepted = true;
    syncLog.tenantResponse.acceptedAt = new Date();

    await syncLog.save({ session });

    await session.commitTransaction();

    logger.info('Synced order accepted by tenant', { syncLogId, tenantUserId });

    res.json({
      success: true,
      message: 'Stock receipt confirmed',
      data: { syncLog }
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Accept synced order failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to accept order',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// Report issue with synced order
exports.reportSyncIssue = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { syncLogId } = req.params;
    const { issues } = req.body;
    const tenantUserId = req.user.id;

    const syncLog = await SyncLog.findOne({
      _id: syncLogId,
      tenantUserId
    }).session(session);

    if (!syncLog) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Sync log not found'
      });
    }

    syncLog.tenantResponse.accepted = false;
    syncLog.tenantResponse.acceptedAt = new Date();
    syncLog.tenantResponse.issues = issues;

    await syncLog.save({ session });

    // Notify supplier about the issue
    const supplierUser = await User.findById(
      syncLog.organizationId
    ).session(session);

    if (supplierUser) {
      await Notification.create([{
        userId: supplierUser._id,
        type: 'alert',
        category: 'sync-issue',
        title: 'Sync Issue Reported',
        message: `Tenant reported issues with synced order ${syncLog.supplierChallanNumber}`,
        data: {
          syncLogId: syncLog._id,
          tenantUserId,
          issues
        },
        priority: 'high',
        read: false,
        organizationId: supplierUser._id
      }], { session });
    }

    await session.commitTransaction();

    logger.info('Sync issue reported by tenant', { syncLogId, tenantUserId });

    res.json({
      success: true,
      message: 'Issue reported. Supplier will be notified.',
      data: { syncLog }
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Report sync issue failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to report issue',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// ==================== SUPPLIER SYNC LOGS ====================

// Get sync logs for supplier (supplier view) - UPDATED FOR SUPPLIER SYNC MODEL
exports.getSupplierSyncLogs = async (req, res) => {
  try {
    const { role, organizationId } = req.user;
    const { dateRange } = req.query;

    if (role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    // Calculate date filter
    let dateFilter = {};
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let daysAgo = 0;
      
      if (dateRange === 'today') {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        dateFilter = { syncedAt: { $gte: startOfDay } };
      } else if (dateRange === '7days') {
        daysAgo = 7;
      } else if (dateRange === '30days') {
        daysAgo = 30;
      }
      
      if (daysAgo > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
        cutoffDate.setHours(0, 0, 0, 0);
        dateFilter = { syncedAt: { $gte: cutoffDate } };
      }
    }

    // Use SupplierSync model (not SyncLog)
    const SupplierSync = require('../models/SupplierSync');
    const User = require('../models/User');

    // Fetch logs for this supplier/organization
    const logs = await SupplierSync.find({
      supplierTenantId: organizationId,
      ...dateFilter
    })
      .sort({ syncedAt: -1 })
      .limit(500)
      .lean();

    // Get customer names
    const customerIds = [...new Set(logs.map(l => l.customerTenantId))];
    const customers = await User.find({ _id: { $in: customerIds } })
      .select('_id name email companyName')
      .lean();

    const customerMap = {};
    customers.forEach(c => {
      customerMap[c._id] = c.name || c.email || 'Unknown';
    });

    // Format logs with customer names
    const formattedLogs = logs.map(log => ({
      _id: log._id,
      syncType: log.syncType,
      success: log.status === 'synced',
      syncedAt: log.syncedAt,
      customerTenantId: log.customerTenantId,
      customerName: customerMap[log.customerTenantId] || 'Unknown',
      orderChallanNumber: log.metadata?.orderChallanNumber || 'N/A',
      buyerName: log.metadata?.buyerName || 'N/A',
      itemsCount: log.itemsSynced?.length || 0,
      totalAmount: log.metadata?.orderTotalAmount || 0,
      errorMessage: log.errorMessage || null,
      wholesaleOrderId: log.wholesaleOrderId
    }));

    // Calculate stats
    const stats = {
      totalSyncs: logs.length,
      successfulSyncs: logs.filter(l => l.status === 'synced').length,
      failedSyncs: logs.filter(l => l.status === 'failed').length,
      createSyncs: logs.filter(l => l.syncType === 'create').length,
      editSyncs: logs.filter(l => l.syncType === 'edit').length,
      deleteSyncs: logs.filter(l => l.syncType === 'delete').length
    };

    logger.info('Fetched supplier sync logs', {
      adminId: req.user._id,
      logsCount: logs.length,
      dateRange
    });

    res.json({
      success: true,
      data: {
        logs: formattedLogs,
        stats
      }
    });
  } catch (error) {
    logger.error('Get supplier sync logs failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sync logs',
      error: error.message
    });
  }
};

module.exports = exports;
