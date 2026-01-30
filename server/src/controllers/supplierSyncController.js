const SupplierSync = require('../models/SupplierSync');
const FactoryReceiving = require('../models/FactoryReceiving');
const WholesaleOrder = require('../models/WholesaleOrder');
const WholesaleBuyer = require('../models/WholesaleBuyer');
const User = require('../models/User');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');

// Get all supplier sync logs (for admin dashboard)
exports.getAllSupplierSyncLogs = async (req, res) => {
  try {
    const { dateRange } = req.query;
    const supplierTenantId = req.user.organizationId;

    // Build date filter
    let dateFilter = {};
    if (dateRange === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dateFilter = { syncedAt: { $gte: today } };
    } else if (dateRange === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      dateFilter = { syncedAt: { $gte: sevenDaysAgo } };
    } else if (dateRange === '30days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFilter = { syncedAt: { $gte: thirtyDaysAgo } };
    }

    const logs = await SupplierSync.find({
      supplierTenantId: supplierTenantId,
      ...dateFilter
    })
      .sort({ syncedAt: -1 })
      .limit(500)
      .lean();

    // Enrich with order and customer data
    const enrichedLogs = await Promise.all(
      logs.map(async (log) => {
        const order = await WholesaleOrder.findById(log.wholesaleOrderId)
          .select('challanNumber buyerName totalAmount')
          .lean();

        const customerUser = await User.findOne({
          organizationId: log.customerTenantId
        })
          .select('businessName email')
          .lean();

        return {
          ...log,
          orderChallanNumber: order?.challanNumber || 'N/A',
          buyerName: order?.buyerName || 'Unknown',
          totalAmount: order?.totalAmount || 0,
          customerName: customerUser?.businessName || customerUser?.email || 'Unknown',
          itemsCount: log.itemsSynced?.length || 0,
          success: log.status === 'synced' || log.status === 'accepted'
        };
      })
    );

    // Calculate stats
    const stats = {
      totalSyncs: enrichedLogs.length,
      successfulSyncs: enrichedLogs.filter(l => l.success).length,
      failedSyncs: enrichedLogs.filter(l => !l.success).length,
      pendingSyncs: enrichedLogs.filter(l => l.status === 'pending').length,
      createSyncs: enrichedLogs.filter(l => l.syncType === 'create').length,
      editSyncs: enrichedLogs.filter(l => l.syncType === 'edit').length,
      deleteSyncs: enrichedLogs.filter(l => l.syncType === 'delete').length
    };

    res.json({
      success: true,
      data: {
        logs: enrichedLogs,
        stats: stats
      }
    });
  } catch (error) {
    console.error('Error fetching supplier sync logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sync logs',
      error: error.message
    });
  }
};

// 🆕 NEW: Main function - handles both direct and manual sync
exports.syncOrderToCustomer = async (wholesaleOrderId, supplierTenantId) => {
  try {
    console.log('🔄 SYNC: Starting sync for order', wholesaleOrderId);

    // Get the wholesale order
    const order = await WholesaleOrder.findById(wholesaleOrderId);
    if (!order) {
      throw new Error('Wholesale order not found');
    }

    // Get the buyer and check if they have a customer account
    const buyer = await WholesaleBuyer.findOne({
      mobile: order.buyerContact,
      organizationId: supplierTenantId
    });

    if (!buyer || !buyer.customerTenantId) {
      console.log('🔄 SYNC: Buyer doesn\'t have customer account. Skipping sync.');
      
      // Update order status
      await WholesaleOrder.findByIdAndUpdate(wholesaleOrderId, {
        syncStatus: 'none'
      });
      
      return { synced: false, reason: 'Buyer is not a customer' };
    }

    const customerUserId = buyer.customerTenantId;

    // Get customer user and their organization
    const customerUser = await User.findById(customerUserId);
    if (!customerUser || !customerUser.isActive) {
      console.log('🔄 SYNC: Customer account not found or not active. Skipping sync.');
      return { synced: false, reason: 'Customer account not active' };
    }

    const customerOrgId = customerUser.organizationId;
    if (!customerOrgId) {
      console.log('🔄 SYNC: Customer has no organization. Skipping sync.');
      return { synced: false, reason: 'Customer has no organization' };
    }

    console.log('✅ SYNC: Customer organization found:', customerOrgId);

    // 🆕 NEW: Check buyer's sync preference
    if (buyer.syncPreference === 'manual') {
      // Create sync request (pending approval)
      return await createSyncRequest(order, supplierTenantId, customerOrgId, customerUser, buyer);
    } else {
      // Direct sync (existing behavior)
      return await performDirectSync(order, supplierTenantId, customerOrgId, customerUser);
    }

  } catch (error) {
    console.error('🔴 SYNC Error:', error);
    
    // Log failed sync
    try {
      await SupplierSync.create({
        supplierTenantId: supplierTenantId,
        customerTenantId: 'unknown',
        wholesaleOrderId: wholesaleOrderId,
        syncType: 'create',
        status: 'failed',
        errorMessage: error.message
      });
    } catch (logError) {
      console.error('🔴 SYNC: Failed to log sync failure:', logError);
    }

    throw error;
  }
};

// 🆕 NEW: Create sync request for manual approval
async function createSyncRequest(order, supplierTenantId, customerOrgId, customerUser, buyer) {
  console.log('📋 SYNC: Creating manual sync request');

  // Get supplier company name
  const supplierUser = await User.findOne({ organizationId: supplierTenantId });
  const supplierCompanyName = supplierUser?.businessName || 'Supplier';

  // Group items by design + color
  const itemGroups = {};
  for (const item of order.items) {
    const key = `${item.design}-${item.color}`;
    if (!itemGroups[key]) {
      itemGroups[key] = {
        design: item.design,
        color: item.color,
        quantities: {},
        totalQuantity: 0,
        pricePerUnit: item.pricePerUnit
      };
    }
    itemGroups[key].quantities[item.size] = (itemGroups[key].quantities[item.size] || 0) + item.quantity;
    itemGroups[key].totalQuantity += item.quantity;
  }

  const itemsSynced = Object.values(itemGroups);

  // Create SupplierSync record with pending status
  const supplierSync = await SupplierSync.create({
    supplierTenantId: supplierTenantId,
    customerTenantId: customerOrgId,
    wholesaleOrderId: order._id,
    syncType: 'create',
    itemsSynced: itemsSynced,
    status: 'pending',
    metadata: {
      orderChallanNumber: order.challanNumber,
      orderTotalAmount: order.totalAmount,
      orderDate: order.createdAt,
      buyerName: order.buyerName,
      supplierCompanyName: supplierCompanyName
    }
  });

  // Update wholesale order with pending status
  await WholesaleOrder.findByIdAndUpdate(order._id, {
    syncStatus: 'pending',
    customerTenantId: customerOrgId,
    $push: {
      syncRequests: {
        requestId: supplierSync._id,
        sentAt: new Date(),
        status: 'pending'
      }
    }
  });

  // Create notification for customer
  try {
    await Notification.create({
      userId: customerUser._id,
      type: 'sync_request',
      title: 'New Stock Sync Request',
      message: `${supplierCompanyName} sent a sync request for ${itemsSynced.length} items. Order: ${order.challanNumber || 'N/A'}`,
      severity: 'info',
      relatedId: supplierSync._id,
      relatedModel: 'SupplierSync',
      organizationId: customerOrgId,
      metadata: {
        supplierName: supplierCompanyName,
        challanNumber: order.challanNumber,
        totalAmount: order.totalAmount,
        itemsCount: itemsSynced.length
      }
    });
  } catch (notifError) {
    console.warn('⚠️ SYNC: Failed to create notification (non-critical):', notifError.message);
  }

  console.log('✅ SYNC: Manual sync request created:', supplierSync._id);

  return {
    synced: false,
    pending: true,
    syncRequestId: supplierSync._id,
    message: 'Sync request sent to customer for approval'
  };
}

// 🆕 NEW: Perform direct sync (existing logic)
async function performDirectSync(order, supplierTenantId, customerOrgId, customerUser) {
  console.log('⚡ SYNC: Performing direct sync');

  // Get supplier company name
  const supplierUser = await User.findOne({ organizationId: supplierTenantId });
  const supplierCompanyName = supplierUser?.businessName || 'Supplier';

  // Group items by design + color to avoid duplicates
  const itemGroups = {};
  for (const item of order.items) {
    const key = `${item.design}-${item.color}`;
    if (!itemGroups[key]) {
      itemGroups[key] = {
        design: item.design,
        color: item.color,
        quantities: {},
        totalQuantity: 0,
        pricePerUnit: item.pricePerUnit
      };
    }
    itemGroups[key].quantities[item.size] = (itemGroups[key].quantities[item.size] || 0) + item.quantity;
    itemGroups[key].totalQuantity += item.quantity;
  }

  console.log('📦 SYNC: Grouped items:', Object.keys(itemGroups).length, 'unique design-color combinations');

  // Create FactoryReceiving entries for each unique design-color
  const factoryReceivingIds = [];
  const itemsSynced = [];

  for (const key in itemGroups) {
    const item = itemGroups[key];

    // Ensure product exists in customer's inventory
    let customerProduct = await Product.findOne({
      design: item.design,
      organizationId: customerOrgId
    });

    // If product doesn't exist, create it
    if (!customerProduct) {
      const supplierProduct = await Product.findOne({
        design: item.design,
        organizationId: supplierTenantId
      });

      if (!supplierProduct) {
        console.log(`⚠️ SYNC: Product ${item.design} not found in supplier inventory. Skipping.`);
        continue;
      }

      // Find the ordered color in supplier's product
      const supplierColorVariant = supplierProduct.colors.find(c => c.color === item.color);
      if (!supplierColorVariant) {
        console.log(`⚠️ SYNC: Color ${item.color} not found in supplier product ${item.design}. Skipping.`);
        continue;
      }

      // Create product with ONLY the ordered color
      const colorToCreate = {
        color: supplierColorVariant.color,
        wholesalePrice: supplierColorVariant.wholesalePrice,
        retailPrice: supplierColorVariant.retailPrice,
        sizes: supplierColorVariant.sizes.map(s => ({
          size: s.size,
          currentStock: 0,
          reservedStock: 0,
          lockedStock: 0,
          reorderPoint: s.reorderPoint || 20
        }))
      };

      customerProduct = await Product.create({
        design: item.design,
        description: supplierProduct.description,
        colors: [colorToCreate],
        organizationId: customerOrgId,
        syncedFromSupplier: true,
        supplierProductId: supplierProduct._id,
        createdBy: {
          userId: customerUser._id,
          userName: 'System Auto-sync'
        }
      });

      console.log(`✅ SYNC: Created product ${item.design} with color ${item.color} in customer inventory`);
    }

    // Check if the ordered color exists, if not ADD IT
    let colorVariant = customerProduct.colors.find(c => c.color === item.color);
    if (!colorVariant) {
      console.log(`🔄 SYNC: Color ${item.color} not found in customer's ${item.design}. Adding it...`);
      
      const supplierProduct = await Product.findOne({
        design: item.design,
        organizationId: supplierTenantId
      });

      if (supplierProduct) {
        const supplierColorVariant = supplierProduct.colors.find(c => c.color === item.color);
        if (supplierColorVariant) {
          const newColor = {
            color: supplierColorVariant.color,
            wholesalePrice: supplierColorVariant.wholesalePrice,
            retailPrice: supplierColorVariant.retailPrice,
            sizes: supplierColorVariant.sizes.map(s => ({
              size: s.size,
              currentStock: 0,
              reservedStock: 0,
              lockedStock: 0,
              reorderPoint: s.reorderPoint || 20
            }))
          };
          
          customerProduct.colors.push(newColor);
          await customerProduct.save();
          colorVariant = customerProduct.colors.find(c => c.color === item.color);
          
          console.log(`✅ SYNC: Added color ${item.color} to customer's ${item.design}`);
        }
      }
    }

    // Create FactoryReceiving entry
    const factoryReceiving = await FactoryReceiving.create({
      design: item.design,
      color: item.color,
      quantities: item.quantities,
      totalQuantity: item.totalQuantity,
      batchId: order.challanNumber || `WH-${order._id}`,
      notes: `Auto-synced from ${supplierCompanyName} - Order ${order.challanNumber || order._id}`,
      receivedDate: order.createdAt,
      receivedBy: 'System Auto-sync',
      sourceType: 'supplier-sync',
      sourceName: supplierCompanyName.toLowerCase(),
      organizationId: customerOrgId,
      supplierTenantId: supplierTenantId,
      supplierWholesaleOrderId: order._id,
      isReadOnly: true,
      supplierMetadata: {
        challanNumber: order.challanNumber,
        orderDate: order.createdAt,
        supplierCompanyName: supplierCompanyName
      },
      createdBy: {
        userId: customerUser._id,
        userName: 'System Auto-sync'
      }
    });

    // Update customer's product stock
    if (colorVariant) {
      Object.entries(item.quantities).forEach(([size, qty]) => {
        const sizeStock = colorVariant.sizes.find(s => s.size === size);
        if (sizeStock) {
          sizeStock.currentStock += qty;
          console.log(`📈 SYNC: Updated stock for ${item.design} ${item.color} ${size}: +${qty} (new: ${sizeStock.currentStock})`);
        } else {
          console.warn(`⚠️ SYNC: Size ${size} not found in ${item.design} ${item.color}`);
        }
      });
      await customerProduct.save();
    } else {
      console.error(`❌ SYNC: Failed to find/create color ${item.color} for ${item.design}`);
    }

    factoryReceivingIds.push(factoryReceiving._id);
    itemsSynced.push({
      design: item.design,
      color: item.color,
      quantities: item.quantities,
      pricePerUnit: item.pricePerUnit
    });

    console.log(`✅ SYNC: Created FactoryReceiving for ${item.design} - ${item.color} (${item.totalQuantity} units)`);
  }

  // Create SupplierSync record
  const supplierSync = await SupplierSync.create({
    supplierTenantId: supplierTenantId,
    customerTenantId: customerOrgId,
    wholesaleOrderId: order._id,
    syncType: 'create',
    itemsSynced: itemsSynced,
    factoryReceivingIds: factoryReceivingIds,
    status: 'synced',
    metadata: {
      orderChallanNumber: order.challanNumber,
      orderTotalAmount: order.totalAmount,
      orderDate: order.createdAt,
      buyerName: order.buyerName
    }
  });

  // Update wholesale order
  await WholesaleOrder.findByIdAndUpdate(order._id, {
    syncedToCustomer: true,
    syncedAt: new Date(),
    syncStatus: 'synced',
    customerTenantId: customerOrgId
  });

  // Create notification for customer (optional)
  try {
    await Notification.create({
      userId: customerUser._id,
      type: 'stock_received',
      title: 'New Stock Received',
      message: `${itemsSynced.length} items received from ${supplierCompanyName}. Order: ${order.challanNumber || 'N/A'}`,
      severity: 'info',
      relatedId: supplierSync._id,
      relatedModel: 'SupplierSync',
      organizationId: customerOrgId
    });
  } catch (notifError) {
    console.warn('⚠️ SYNC: Failed to create notification (non-critical):', notifError.message);
  }

  console.log('✅ SYNC: Successfully synced order to customer', customerOrgId);

  return {
    synced: true,
    supplierSyncId: supplierSync._id,
    factoryReceivingIds: factoryReceivingIds,
    itemsCount: itemsSynced.length
  };
}

// 🆕 NEW: Accept sync request
// 🆕 NEW: Accept sync request
exports.acceptSyncRequest = async (req, res) => {
  try {
    const { syncId } = req.params;
    const userId = req.user.id;
    const userName = req.user.name || req.user.email;
    const userEmail = req.user.email;
    const customerOrgId = req.user.organizationId;

    console.log('✅ ACCEPT SYNC:', syncId, 'by', userName);

    // Get sync request
    const syncRequest = await SupplierSync.findById(syncId);
    if (!syncRequest) {
      return res.status(404).json({
        success: false,
        message: 'Sync request not found'
      });
    }

    // Check if already processed
    if (syncRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Sync request already ${syncRequest.status}`
      });
    }

    // Get the wholesale order
    const order = await WholesaleOrder.findById(syncRequest.wholesaleOrderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Get customer user
    const customerUser = await User.findById(userId);
    if (!customerUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Perform the sync
    const supplierUser = await User.findOne({ organizationId: syncRequest.supplierTenantId });
    const supplierCompanyName = supplierUser?.businessName || 'Supplier';

    const factoryReceivingIds = [];
    const itemsSynced = [];

    // Create FactoryReceiving entries and update stock
    for (const item of syncRequest.itemsSynced) {
      // ✅ FIX: Calculate totalQuantity if not present
      let totalQuantity = item.totalQuantity;
      if (!totalQuantity) {
        totalQuantity = Object.values(item.quantities).reduce((sum, qty) => sum + qty, 0);
      }

      // Ensure product exists
      let customerProduct = await Product.findOne({
        design: item.design,
        organizationId: customerOrgId
      });

      if (!customerProduct) {
        const supplierProduct = await Product.findOne({
          design: item.design,
          organizationId: syncRequest.supplierTenantId
        });

        if (supplierProduct) {
          const supplierColorVariant = supplierProduct.colors.find(c => c.color === item.color);
          if (supplierColorVariant) {
            customerProduct = await Product.create({
              design: item.design,
              description: supplierProduct.description,
              colors: [{
                color: supplierColorVariant.color,
                wholesalePrice: supplierColorVariant.wholesalePrice,
                retailPrice: supplierColorVariant.retailPrice,
                sizes: supplierColorVariant.sizes.map(s => ({
                  size: s.size,
                  currentStock: 0,
                  reservedStock: 0,
                  lockedStock: 0,
                  reorderPoint: s.reorderPoint || 20
                }))
              }],
              organizationId: customerOrgId,
              syncedFromSupplier: true,
              supplierProductId: supplierProduct._id,
              createdBy: {
                userId: customerUser._id,
                userName: userName
              }
            });
          }
        }
      }

      if (!customerProduct) {
        console.warn(`⚠️ Could not create product ${item.design}`);
        continue;
      }

      // Check/add color
      let colorVariant = customerProduct.colors.find(c => c.color === item.color);
      if (!colorVariant) {
        const supplierProduct = await Product.findOne({
          design: item.design,
          organizationId: syncRequest.supplierTenantId
        });

        if (supplierProduct) {
          const supplierColorVariant = supplierProduct.colors.find(c => c.color === item.color);
          if (supplierColorVariant) {
            customerProduct.colors.push({
              color: supplierColorVariant.color,
              wholesalePrice: supplierColorVariant.wholesalePrice,
              retailPrice: supplierColorVariant.retailPrice,
              sizes: supplierColorVariant.sizes.map(s => ({
                size: s.size,
                currentStock: 0,
                reservedStock: 0,
                lockedStock: 0,
                reorderPoint: s.reorderPoint || 20
              }))
            });
            await customerProduct.save();
            colorVariant = customerProduct.colors.find(c => c.color === item.color);
          }
        }
      }

      // Create FactoryReceiving
      const factoryReceiving = await FactoryReceiving.create({
        design: item.design,
        color: item.color,
        quantities: item.quantities,
        totalQuantity: totalQuantity,  // ✅ FIXED: Use calculated totalQuantity
        batchId: order.challanNumber || `WH-${order._id}`,
        notes: `Synced from ${supplierCompanyName} - Order ${order.challanNumber || order._id} (Accepted by ${userName})`,
        receivedDate: order.createdAt,
        receivedBy: userName,
        sourceType: 'supplier-sync',
        sourceName: supplierCompanyName.toLowerCase(),
        organizationId: customerOrgId,
        supplierTenantId: syncRequest.supplierTenantId,
        supplierWholesaleOrderId: order._id,
        isReadOnly: true,
        supplierMetadata: {
          challanNumber: order.challanNumber,
          orderDate: order.createdAt,
          supplierCompanyName: supplierCompanyName,
          acceptedBy: userName,
          acceptedAt: new Date()
        },
        createdBy: {
          userId: customerUser._id,
          userName: userName
        }
      });

      // Update stock
      if (colorVariant) {
        Object.entries(item.quantities).forEach(([size, qty]) => {
          const sizeStock = colorVariant.sizes.find(s => s.size === size);
          if (sizeStock) {
            sizeStock.currentStock += qty;
          }
        });
        await customerProduct.save();
      }

      factoryReceivingIds.push(factoryReceiving._id);
      itemsSynced.push(item);
    }

    // Update sync request
    syncRequest.status = 'accepted';
    syncRequest.approvedBy = {
      userId: userId,
      userName: userName,
      userEmail: userEmail,
      approvedAt: new Date()
    };
    syncRequest.factoryReceivingIds = factoryReceivingIds;
    await syncRequest.save();

    // Update wholesale order
    await WholesaleOrder.findByIdAndUpdate(order._id, {
      syncedToCustomer: true,
      syncedAt: new Date(),
      syncStatus: 'accepted',
      'syncRequests.$[elem].status': 'accepted',
      'syncRequests.$[elem].respondedAt': new Date(),
      'syncRequests.$[elem].respondedBy': {
        userId: userId,
        userName: userName,
        userEmail: userEmail
      }
    }, {
      arrayFilters: [{ 'elem.requestId': syncRequest._id }]
    });

    // Notify supplier
    try {
      const supplierUsers = await User.find({ organizationId: syncRequest.supplierTenantId });
      for (const supplierUser of supplierUsers) {
        await Notification.create({
          userId: supplierUser._id,
          type: 'sync_accepted',
          title: 'Sync Request Accepted',
          message: `${userName} accepted sync request for Order ${order.challanNumber || 'N/A'}`,
          severity: 'success',
          relatedId: syncRequest._id,
          relatedModel: 'SupplierSync',
          organizationId: syncRequest.supplierTenantId
        });
      }
    } catch (notifError) {
      console.warn('⚠️ Failed to notify supplier:', notifError.message);
    }

    res.json({
      success: true,
      message: 'Sync request accepted successfully',
      data: {
        syncId: syncRequest._id,
        itemsCount: itemsSynced.length,
        acceptedBy: userName,
        acceptedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error accepting sync request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept sync request',
      error: error.message
    });
  }
};

// 🆕 NEW: Reject sync request
exports.rejectSyncRequest = async (req, res) => {
  try {
    const { syncId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;
    const userName = req.user.name || req.user.email;
    const userEmail = req.user.email;

    console.log('❌ REJECT SYNC:', syncId, 'by', userName);

    // Get sync request
    const syncRequest = await SupplierSync.findById(syncId);
    if (!syncRequest) {
      return res.status(404).json({
        success: false,
        message: 'Sync request not found'
      });
    }

    // Check if already processed
    if (syncRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Sync request already ${syncRequest.status}`
      });
    }

    // Update sync request
    syncRequest.status = 'rejected';
    syncRequest.rejectedBy = {
      userId: userId,
      userName: userName,
      userEmail: userEmail,
      rejectedAt: new Date(),
      reason: reason || 'No reason provided'
    };
    await syncRequest.save();

    // Update wholesale order
    await WholesaleOrder.findByIdAndUpdate(syncRequest.wholesaleOrderId, {
      syncStatus: 'rejected',
      'syncRequests.$[elem].status': 'rejected',
      'syncRequests.$[elem].respondedAt': new Date(),
      'syncRequests.$[elem].respondedBy': {
        userId: userId,
        userName: userName,
        userEmail: userEmail
      },
      'syncRequests.$[elem].rejectionReason': reason || 'No reason provided'
    }, {
      arrayFilters: [{ 'elem.requestId': syncRequest._id }]
    });

    // Notify supplier
    try {
      const order = await WholesaleOrder.findById(syncRequest.wholesaleOrderId);
      const supplierUsers = await User.find({ organizationId: syncRequest.supplierTenantId });
      
      for (const supplierUser of supplierUsers) {
        await Notification.create({
          userId: supplierUser._id,
          type: 'sync_rejected',
          title: 'Sync Request Rejected',
          message: `${userName} rejected sync request for Order ${order?.challanNumber || 'N/A'}. Reason: ${reason || 'Not specified'}`,
          severity: 'warning',
          relatedId: syncRequest._id,
          relatedModel: 'SupplierSync',
          organizationId: syncRequest.supplierTenantId
        });
      }
    } catch (notifError) {
      console.warn('⚠️ Failed to notify supplier:', notifError.message);
    }

    res.json({
      success: true,
      message: 'Sync request rejected',
      data: {
        syncId: syncRequest._id,
        rejectedBy: userName,
        rejectedAt: new Date(),
        reason: reason || 'No reason provided'
      }
    });

  } catch (error) {
    console.error('Error rejecting sync request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject sync request',
      error: error.message
    });
  }
};

// 🆕 NEW: Resend sync request
exports.resendSyncRequest = async (req, res) => {
  try {
    const { orderId } = req.params;
    const supplierTenantId = req.user.organizationId;

    console.log('🔄 RESEND SYNC:', orderId);

    // Get order
    const order = await WholesaleOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if order belongs to this supplier
    if (order.organizationId.toString() !== supplierTenantId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // ✅ NEW: Check if already synced/pending
    if (order.syncStatus === 'synced' || order.syncStatus === 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Order is already synced'
      });
    }

    if (order.syncStatus === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Sync request already pending'
      });
    }

    // Get buyer
    const buyer = await WholesaleBuyer.findById(order.buyerId);
    if (!buyer || !buyer.customerTenantId) {
      return res.status(400).json({
        success: false,
        message: 'Buyer is not a customer'
      });
    }

    // Get customer user
    const customerUser = await User.findById(buyer.customerTenantId);
    if (!customerUser) {
      return res.status(400).json({
        success: false,
        message: 'Customer user not found'
      });
    }

    const customerOrgId = customerUser.organizationId;

    // ✅ NEW: If previously rejected, mark old sync as cancelled and create new one
    if (order.syncStatus === 'rejected') {
      await SupplierSync.updateMany(
        {
          wholesaleOrderId: orderId,
          status: 'rejected'
        },
        {
          $set: { status: 'cancelled' }
        }
      );
    }

    // Create new sync request
    const result = await createSyncRequest(order, supplierTenantId, customerOrgId, customerUser, buyer);

    res.json({
      success: true,
      message: 'Sync request resent successfully',
      data: result
    });
  } catch (error) {
    console.error('Error resending sync request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend sync request',
      error: error.message
    });
  }
};

// 🆕 NEW: Get pending sync requests (for customer)
exports.getPendingSyncRequests = async (req, res) => {
  try {
    const customerOrgId = req.user.organizationId;

    const pendingRequests = await SupplierSync.find({
      customerTenantId: customerOrgId,
      status: 'pending'
    })
      .sort({ createdAt: -1 })
      .lean();

    // Enrich with order details
    const enrichedRequests = await Promise.all(
      pendingRequests.map(async (request) => {
        const order = await WholesaleOrder.findById(request.wholesaleOrderId)
          .select('challanNumber buyerName totalAmount createdAt')
          .lean();

        const supplierUser = await User.findOne({ organizationId: request.supplierTenantId })
          .select('businessName email')
          .lean();

        return {
          ...request,
          order: {
            challanNumber: order?.challanNumber || 'N/A',
            buyerName: order?.buyerName || 'Unknown',
            totalAmount: order?.totalAmount || 0,
            date: order?.createdAt
          },
          supplier: {
            name: supplierUser?.businessName || supplierUser?.email || 'Unknown'
          }
        };
      })
    );

    res.json({
      success: true,
      data: enrichedRequests,
      count: enrichedRequests.length
    });

  } catch (error) {
    console.error('Error fetching pending sync requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending sync requests',
      error: error.message
    });
  }
};

// Edit sync - update customer's receiving when supplier edits order within 24hrs
exports.syncOrderEdit = async (wholesaleOrderId, supplierTenantId, changesMade) => {
  try {
    console.log('🔄 SYNC-EDIT: Starting edit sync for order', wholesaleOrderId);

    const order = await WholesaleOrder.findById(wholesaleOrderId);
    if (!order || !order.syncedToCustomer) {
      console.log('🔄 SYNC-EDIT: Order not previously synced');
      return { synced: false, reason: 'Order not previously synced' };
    }

    // Check if still within 24-hour edit window
    const orderAge = Date.now() - new Date(order.createdAt).getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    if (orderAge > twentyFourHours) {
      console.log('🔄 SYNC-EDIT: Order is older than 24hrs. Skipping auto-sync.');
      return { synced: false, reason: 'Edit window expired (>24hrs)' };
    }

    // Get previous sync record
    const previousSync = await SupplierSync.findOne({
      wholesaleOrderId: order._id,
      syncType: { $in: ['create', 'edit'] },
      status: { $in: ['synced', 'accepted'] }
    }).sort({ syncedAt: -1 });

    if (!previousSync) {
      console.log('🔄 SYNC-EDIT: No previous sync found');
      return { synced: false, reason: 'No previous sync found' };
    }

    const customerTenantId = previousSync.customerTenantId;

    // Reverse old stock changes
    console.log('🔄 SYNC-EDIT: Reversing old stock changes');
    for (const item of previousSync.itemsSynced) {
      const product = await Product.findOne({
        design: item.design,
        organizationId: customerTenantId
      });

      if (product) {
        const colorVariant = product.colors.find(c => c.color === item.color);
        if (colorVariant) {
          Object.entries(item.quantities).forEach(([size, qty]) => {
            const sizeStock = colorVariant.sizes.find(s => s.size === size);
            if (sizeStock) {
              sizeStock.currentStock = Math.max(0, sizeStock.currentStock - qty);
            }
          });
          await product.save();
        }
      }
    }

    // Delete old FactoryReceiving entries
    await FactoryReceiving.deleteMany({
      _id: { $in: previousSync.factoryReceivingIds }
    });

    // Now add NEW stock
    console.log('🔄 SYNC-EDIT: Adding new stock from updated order');

    const customerUser = await User.findOne({ organizationId: customerTenantId });
    const supplierUser = await User.findOne({ organizationId: supplierTenantId });
    const supplierCompanyName = supplierUser?.businessName || 'Supplier';

    // Group items
    const itemGroups = {};
    for (const item of order.items) {
      const key = `${item.design}-${item.color}`;
      if (!itemGroups[key]) {
        itemGroups[key] = {
          design: item.design,
          color: item.color,
          quantities: {},
          totalQuantity: 0,
          pricePerUnit: item.pricePerUnit
        };
      }
      itemGroups[key].quantities[item.size] = (itemGroups[key].quantities[item.size] || 0) + item.quantity;
      itemGroups[key].totalQuantity += item.quantity;
    }

    const factoryReceivingIds = [];
    const itemsSynced = [];

    for (const key in itemGroups) {
      const item = itemGroups[key];
      const customerProduct = await Product.findOne({
        design: item.design,
        organizationId: customerTenantId
      });

      if (!customerProduct) continue;

      // Create new FactoryReceiving
      const factoryReceiving = await FactoryReceiving.create({
        design: item.design,
        color: item.color,
        quantities: item.quantities,
        totalQuantity: item.totalQuantity,
        batchId: order.challanNumber || `WH-${order._id}`,
        notes: `Auto-synced from ${supplierCompanyName} - Order ${order.challanNumber || order._id} (Edited)`,
        receivedDate: order.createdAt,
        receivedBy: 'System Auto-sync',
        sourceType: 'supplier-sync',
        sourceName: supplierCompanyName.toLowerCase(),
        organizationId: customerTenantId,
        supplierTenantId: supplierTenantId,
        supplierWholesaleOrderId: order._id,
        isReadOnly: true,
        supplierMetadata: {
          challanNumber: order.challanNumber,
          orderDate: order.createdAt,
          supplierCompanyName: supplierCompanyName,
          isEdit: true
        },
        createdBy: {
          userId: customerUser._id,
          userName: 'System Auto-sync'
        }
      });

      // Add new stock
      const colorVariant = customerProduct.colors.find(c => c.color === item.color);
      if (colorVariant) {
        Object.entries(item.quantities).forEach(([size, qty]) => {
          const sizeStock = colorVariant.sizes.find(s => s.size === size);
          if (sizeStock) {
            sizeStock.currentStock += qty;
          }
        });
        await customerProduct.save();
      }

      factoryReceivingIds.push(factoryReceiving._id);
      itemsSynced.push({
        design: item.design,
        color: item.color,
        quantities: item.quantities,
        pricePerUnit: item.pricePerUnit
      });
    }

    // Create edit sync record
    await SupplierSync.create({
      supplierTenantId: supplierTenantId,
      customerTenantId: customerTenantId,
      wholesaleOrderId: order._id,
      syncType: 'edit',
      itemsSynced: itemsSynced,
      factoryReceivingIds: factoryReceivingIds,
      status: 'synced',
      changesMade: changesMade,
      editedWithin24Hours: true,
      metadata: {
        orderChallanNumber: order.challanNumber,
        orderDate: order.createdAt
      }
    });

    console.log('✅ SYNC-EDIT: Successfully synced order edit');

    return {
      synced: true,
      itemsCount: itemsSynced.length,
      factoryReceivingIds: factoryReceivingIds
    };

  } catch (error) {
    console.error('🔴 SYNC-EDIT Error:', error);
    throw error;
  }
};

// Delete sync - remove from customer's inventory when supplier deletes order
exports.syncOrderDelete = async (wholesaleOrderId, supplierTenantId) => {
  try {
    console.log('🗑️ SYNC-DELETE: Starting delete sync for order', wholesaleOrderId);

    // Get sync record
    const syncRecord = await SupplierSync.findOne({
      wholesaleOrderId: wholesaleOrderId,
      supplierTenantId: supplierTenantId,
      syncType: { $in: ['create', 'edit'] },
      status: { $in: ['synced', 'accepted'] }
    }).sort({ syncedAt: -1 });

    if (!syncRecord) {
      console.log('🗑️ SYNC-DELETE: No sync record found');
      return { synced: false, reason: 'No sync record found' };
    }

    const customerTenantId = syncRecord.customerTenantId;

    // Delete FactoryReceiving entries
    const deleteResult = await FactoryReceiving.deleteMany({
      _id: { $in: syncRecord.factoryReceivingIds }
    });

    console.log(`🗑️ SYNC-DELETE: Deleted ${deleteResult.deletedCount} factory receiving entries`);

    // Reverse stock changes
    for (const item of syncRecord.itemsSynced) {
      const product = await Product.findOne({
        design: item.design,
        organizationId: customerTenantId
      });

      if (product) {
        const colorVariant = product.colors.find(c => c.color === item.color);
        if (colorVariant) {
          Object.entries(item.quantities).forEach(([size, qty]) => {
            const sizeStock = colorVariant.sizes.find(s => s.size === size);
            if (sizeStock) {
              sizeStock.currentStock = Math.max(0, sizeStock.currentStock - qty);
            }
          });
          await product.save();
        }
      }
    }

    // Create delete sync record
    await SupplierSync.create({
      supplierTenantId: supplierTenantId,
      customerTenantId: customerTenantId,
      wholesaleOrderId: wholesaleOrderId,
      syncType: 'delete',
      itemsSynced: syncRecord.itemsSynced,
      status: 'synced',
      metadata: syncRecord.metadata
    });

    console.log('✅ SYNC-DELETE: Successfully removed receivings and reversed stock');

    return {
      synced: true,
      receivingsDeleted: deleteResult.deletedCount,
      itemsAffected: syncRecord.itemsSynced.length
    };

  } catch (error) {
    console.error('🔴 SYNC-DELETE Error:', error);
    throw error;
  }
};

// Get customer's received orders from supplier
exports.getReceivedFromSupplier = async (req, res) => {
  try {
    const customerOrgId = req.user.organizationId;

    const receivings = await FactoryReceiving.find({
      organizationId: customerOrgId,
      sourceType: 'supplier-sync'
    })
      .sort({ receivedDate: -1 })
      .lean();

    // Group by order
    const groupedOrders = receivings.reduce((acc, receiving) => {
      const orderId = receiving.supplierWholesaleOrderId?.toString() || receiving.batchId;
      
      if (!acc[orderId]) {
        acc[orderId] = {
          orderId: orderId,
          batchId: receiving.batchId,
          challanNumber: receiving.supplierMetadata?.challanNumber || receiving.batchId,
          orderDate: receiving.supplierMetadata?.orderDate || receiving.receivedDate,
          supplierName: receiving.supplierMetadata?.supplierCompanyName || receiving.sourceName,
          receivedDate: receiving.receivedDate,
          receivedBy: receiving.receivedBy,
          acceptedBy: receiving.supplierMetadata?.acceptedBy,
          acceptedAt: receiving.supplierMetadata?.acceptedAt,
          items: [],
          totalQuantity: 0
        };
      }

      acc[orderId].items.push({
        design: receiving.design,
        color: receiving.color,
        quantities: receiving.quantities instanceof Map ? Object.fromEntries(receiving.quantities) : receiving.quantities,
        totalQuantity: receiving.totalQuantity
      });

      acc[orderId].totalQuantity += receiving.totalQuantity;

      return acc;
    }, {});

    const orders = Object.values(groupedOrders);

    res.json({
      success: true,
      data: {
        orders,
        totalOrders: orders.length,
        totalItems: receivings.length
      }
    });

  } catch (error) {
    console.error('Error in getReceivedFromSupplier:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch received orders',
      error: error.message
    });
  }
};

module.exports = {
  getAllSupplierSyncLogs: exports.getAllSupplierSyncLogs,
  syncOrderToCustomer: exports.syncOrderToCustomer,
  acceptSyncRequest: exports.acceptSyncRequest,
  rejectSyncRequest: exports.rejectSyncRequest,
  resendSyncRequest: exports.resendSyncRequest,
  getPendingSyncRequests: exports.getPendingSyncRequests,
  syncOrderEdit: exports.syncOrderEdit,
  syncOrderDelete: exports.syncOrderDelete,
  getReceivedFromSupplier: exports.getReceivedFromSupplier
};
