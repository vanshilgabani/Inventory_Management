const SupplierSync = require('../models/SupplierSync');
const FactoryReceiving = require('../models/FactoryReceiving');
const WholesaleOrder = require('../models/WholesaleOrder');
const WholesaleBuyer = require('../models/WholesaleBuyer');
const User = require('../models/User');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');

// ✅ Helper: Get all admin users of a customer org (org-wide)
const getOrgAdmins = async (orgId) => {
  return await User.find({
    $or: [
      { _id: orgId, isActive: true },                          // master admin themselves
      { organizationId: orgId, role: 'admin', isActive: true } // other admins in org
    ]
  }).lean();
};

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

    const customerOrgId = customerUser.organizationId || customerUser._id;
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
        customerTenantId: null,
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
    const customerAdmins = await getOrgAdmins(customerOrgId);
    await Promise.all(customerAdmins.map(admin =>
      Notification.create({
        userId: admin._id,
        type: 'syncrequest',
        title: 'New Stock Sync Request',
        message: `${supplierCompanyName} sent a sync request for ${itemsSynced.length} items. Order: ${order.challanNumber || 'N/A'}`,
        severity: 'info',
        relatedId: supplierSync.id,
        relatedModel: 'SupplierSync',
        organizationId: customerOrgId,
        metadata: { supplierName: supplierCompanyName, challanNumber: order.challanNumber, totalAmount: order.totalAmount, itemsCount: itemsSynced.length }
      })
    ));
  } catch (notifError) {
    console.warn('SYNC: Failed to create notifications (non-critical)', notifError.message);
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

  // ✅ FIXED — notify ALL admins of customer org
  try {
    const customerAdmins = await getOrgAdmins(customerOrgId);
    await Promise.all(customerAdmins.map(admin =>
      Notification.create({
        userId: admin._id,
        type: 'stockreceived',
        title: 'New Stock Received',
        message: `${itemsSynced.length} items received from ${supplierCompanyName}. Order: ${order.challanNumber || 'N/A'}`,
        severity: 'info',
        relatedId: supplierSync.id,
        relatedModel: 'SupplierSync',
        organizationId: customerOrgId
      })
    ));
  } catch (notifError) {
    console.warn('SYNC: Failed to create notifications (non-critical)', notifError.message);
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
exports.acceptSyncRequest = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
    }
    const { syncId } = req.params;
    const userId = req.user.id;
    const userName = req.user.name || req.user.email;
    const userEmail = req.user.email;
    const customerOrgId = req.user.organizationId;

    console.log('✅ ACCEPT SYNC:', syncId, 'by', userName);

    const syncRequest = await SupplierSync.findById(syncId);
    if (!syncRequest) {
      return res.status(404).json({ success: false, message: 'Sync request not found' });
    }

    if (syncRequest.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Sync request already ${syncRequest.status}` });
    }

    const order = await WholesaleOrder.findById(syncRequest.wholesaleOrderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const customerUser = await User.findById(userId);
    if (!customerUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const supplierUser = await User.findOne({ organizationId: syncRequest.supplierTenantId });
    const supplierCompanyName = supplierUser?.businessName || 'Supplier';

    // ══════════════════════════════════════════════════════════════
    // FIX: For EDIT syncs — reverse previous stock before adding new
    // This prevents old qty (5) + new qty (6) = 11 bug
    // ══════════════════════════════════════════════════════════════
    if (syncRequest.syncType === 'edit') {
      console.log('✏️ ACCEPT-EDIT: Reversing previous stock before applying new quantities');

      const previousSync = await SupplierSync.findOne({
        wholesaleOrderId: syncRequest.wholesaleOrderId,
        supplierTenantId: syncRequest.supplierTenantId,
        syncType: { $in: ['create', 'edit'] },
        status: { $in: ['synced', 'accepted'] }
      }).sort({ syncedAt: -1 });

      if (previousSync) {
        // Reverse each item's stock
        for (const item of previousSync.itemsSynced) {
          const product = await Product.findOne({
            design: item.design,
            organizationId: customerOrgId
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
        if (previousSync.factoryReceivingIds?.length) {
          await FactoryReceiving.deleteMany({
            _id: { $in: previousSync.factoryReceivingIds }
          });
          console.log(`✏️ ACCEPT-EDIT: Removed ${previousSync.factoryReceivingIds.length} old receiving entries`);
        }
      } else {
        console.warn('⚠️ ACCEPT-EDIT: No previous sync found to reverse — applying as fresh stock');
      }
    }

    // ══════════════════════════════════════════════════════════════
    // Add new stock (same for both create and edit after reversal)
    // ══════════════════════════════════════════════════════════════
    const factoryReceivingIds = [];
    const itemsSynced = [];

    for (const item of syncRequest.itemsSynced) {
      let totalQuantity = item.totalQuantity;
      if (!totalQuantity) {
        totalQuantity = Object.values(item.quantities).reduce((sum, qty) => sum + qty, 0);
      }

      // Ensure product exists in customer org
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
        console.warn(`⚠️ Could not find or create product ${item.design}`);
        continue;
      }

      // Ensure color variant exists
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

      // Create FactoryReceiving entry
      const factoryReceiving = await FactoryReceiving.create({
        design: item.design,
        color: item.color,
        quantities: item.quantities,
        totalQuantity: totalQuantity,
        batchId: order.challanNumber || `WH-${order._id}`,
        notes: `Synced from ${supplierCompanyName} - Order ${order.challanNumber || order._id}${syncRequest.syncType === 'edit' ? ' (Edit Accepted' : ' (Accepted'} by ${userName})`,
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
          acceptedAt: new Date(),
          isEdit: syncRequest.syncType === 'edit'
        },
        createdBy: {
          userId: customerUser._id,
          userName: userName
        }
      });

      // Add new stock
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

    // Update sync request status
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
      for (const su of supplierUsers) {
        await Notification.create({
          userId: su._id,
          type: 'sync_accepted',
          title: syncRequest.syncType === 'edit' ? 'Edit Request Accepted' : 'Sync Request Accepted',
          message: `${userName} accepted ${syncRequest.syncType === 'edit' ? 'edit' : 'sync'} request for Order ${order.challanNumber || 'N/A'}`,
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
      message: `Sync request ${syncRequest.syncType === 'edit' ? '(edit) ' : ''}accepted successfully`,
      data: {
        syncId: syncRequest._id,
        syncType: syncRequest.syncType,
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
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
    }
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

    const order = await WholesaleOrder.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (order.organizationId.toString() !== supplierTenantId.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (order.syncStatus === 'synced' || order.syncStatus === 'accepted') {
      return res.status(400).json({ success: false, message: 'Order is already synced' });
    }

    if (order.syncStatus === 'pending') {
      return res.status(400).json({ success: false, message: 'Sync request already pending' });
    }

    const buyer = await WholesaleBuyer.findOne({
      mobile: order.buyerContact,
      organizationId: supplierTenantId
    });
    if (!buyer || !buyer.customerTenantId) {
      return res.status(400).json({ success: false, message: 'Buyer is not a customer' });
    }

    const customerUser = await User.findById(buyer.customerTenantId);
    if (!customerUser) {
      return res.status(400).json({ success: false, message: 'Customer account not found' });
    }

    const customerOrgId = customerUser.organizationId || customerUser._id;
    const supplierUser = await User.findOne({ organizationId: supplierTenantId });
    const supplierCompanyName = supplierUser?.businessName || 'Supplier';

    // ── FIX: Check if a previous accepted/synced record exists for this order ──
    // If yes → this resend is an EDIT (customer had stock before, it was reversed on reject)
    // If no  → this resend is a genuine first-time CREATE
    const previousAcceptedSync = await SupplierSync.findOne({
      wholesaleOrderId: order._id,
      supplierTenantId,
      syncType: { $in: ['create', 'edit'] },
      status: { $in: ['synced', 'accepted'] }
    }).sort({ syncedAt: -1 });

    const isResendAfterRejection = !!previousAcceptedSync;
    const syncType = isResendAfterRejection ? 'edit' : 'create';

    // Group items
    const itemGroups = {};
    for (const item of order.items) {
      const key = `${item.design}-${item.color}`;
      if (!itemGroups[key]) {
        itemGroups[key] = { design: item.design, color: item.color, quantities: {}, totalQuantity: 0, pricePerUnit: item.pricePerUnit };
      }
      itemGroups[key].quantities[item.size] = (itemGroups[key].quantities[item.size] || 0) + item.quantity;
      itemGroups[key].totalQuantity += item.quantity;
    }
    const itemsSynced = Object.values(itemGroups);

    // Build diff if this is a re-send after rejection
    let changesMade = null;
    if (isResendAfterRejection) {
      const diffMap = {};
      previousAcceptedSync.itemsSynced.forEach(item => {
        const key = `${item.design}-${item.color}`;
        diffMap[key] = { design: item.design, color: item.color, before: item.quantities, after: null };
      });
      itemsSynced.forEach(item => {
        const key = `${item.design}-${item.color}`;
        if (diffMap[key]) diffMap[key].after = item.quantities;
        else diffMap[key] = { design: item.design, color: item.color, before: null, after: item.quantities };
      });
      changesMade = {
        diff: Object.values(diffMap),
        previouslySyncedAt: previousAcceptedSync.syncedAt,
        editedAt: new Date()
      };
    }

    // Create pending sync record with correct syncType
    const syncRecord = await SupplierSync.create({
      supplierTenantId,
      customerTenantId: customerOrgId,
      wholesaleOrderId: order._id,
      syncType,           // ← 'edit' if resending after prior accepted sync, 'create' if first time
      status: 'pending',
      itemsSynced,
      changesMade,
      metadata: {
        orderChallanNumber: order.challanNumber,
        orderTotalAmount: order.totalAmount,
        orderDate: order.createdAt,
        buyerName: order.buyerName,
        supplierCompanyName
      }
    });

    await WholesaleOrder.findByIdAndUpdate(order._id, {
      syncStatus: 'pending',
      $push: { syncRequests: { requestId: syncRecord._id, sentAt: new Date(), status: 'pending' } }
    });

    // Notify customer
    try {
      const customerAdmins = await getOrgAdmins(customerOrgId);
      await Promise.all(customerAdmins.map(admin =>
        Notification.create({
          userId: admin._id,
          type: isResendAfterRejection ? 'synceditrequest' : 'syncrequest',
          title: isResendAfterRejection ? 'Supplier Resent Edit Request' : 'New Stock Sync Request',
          message: isResendAfterRejection
            ? `${supplierCompanyName} resent changes for Order: ${order.challanNumber || 'N/A'}.`
            : `${supplierCompanyName} sent a sync request for Order: ${order.challanNumber || 'N/A'}.`,
          severity: isResendAfterRejection ? 'warning' : 'info',
          relatedId: syncRecord.id,
          relatedModel: 'SupplierSync',
          organizationId: customerOrgId
        })
      ));
    } catch (notifError) {
      console.warn('Notification failed', notifError.message);
    }

    res.json({ success: true, message: 'Sync request resent successfully', data: { syncId: syncRecord._id, syncType } });

  } catch (error) {
    console.error('Error resending sync request:', error);
    res.status(500).json({ success: false, message: 'Failed to resend sync request', error: error.message });
  }
};

// 🆕 NEW: Get pending sync requests (for customer)
exports.getPendingSyncRequests = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
    }

    const customerOrgId = req.user.organizationId || req.user.id;

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
    if (!order) {
      return { synced: false, reason: 'Order not found' };
    }

    // Check for ANY existing sync (pending counts too — customer may not have accepted yet)
    const hasSyncHistory = order.syncedToCustomer || await SupplierSync.exists({
      wholesaleOrderId: order._id,
      supplierTenantId,
      status: { $in: ['pending', 'synced', 'accepted'] }
    });

    if (!hasSyncHistory) {
      console.log('🔄 SYNC-EDIT: Order has no sync history, skipping edit sync');
      return { synced: false, reason: 'Order not previously synced' };
    }

    // Check 24hr window
    const orderAge = Date.now() - new Date(order.createdAt).getTime();
    if (orderAge > 24 * 60 * 60 * 1000) {
      console.log('🔄 SYNC-EDIT: Order older than 24hrs. Skipping.');
      return { synced: false, reason: 'Edit window expired (>24hrs)' };
    }

    // ── STEP 1: Check for existing pending request FIRST ──
    // Must happen before previousSync guard because rejected orders
    // have no accepted/synced record but may have a new pending one
    const existingPendingSync = await SupplierSync.findOne({
      wholesaleOrderId: order._id,
      supplierTenantId,
      status: 'pending'
    });

    // ── STEP 2: Find last accepted/synced record (for diff + stock reversal) ──
    const previousSync = await SupplierSync.findOne({
      wholesaleOrderId: order._id,
      syncType: { $in: ['create', 'edit'] },
      status: { $in: ['synced', 'accepted'] }
    }).sort({ syncedAt: -1 });

    // ── STEP 3: Determine customerTenantId ──
    // From previousSync if exists, otherwise from existingPendingSync
    const customerTenantId = previousSync?.customerTenantId
      || existingPendingSync?.customerTenantId;

    if (!customerTenantId) {
      console.log('🔄 SYNC-EDIT: Cannot determine customer — no sync history found');
      return { synced: false, reason: 'No sync history found for this order' };
    }

    const customerUser = await User.findOne({ organizationId: customerTenantId });
    if (!customerUser) {
      return { synced: false, reason: 'Customer not found' };
    }

    const buyer = await WholesaleBuyer.findOne({
      mobile: order.buyerContact,
      organizationId: supplierTenantId
    });

    const supplierUser = await User.findOne({ organizationId: supplierTenantId });
    const supplierCompanyName = supplierUser?.businessName || 'Supplier';

    // ── Group new order items ──
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
    const newItemsSynced = Object.values(itemGroups);

    // ── Build diff (use previousSync items if available, else existingPending items) ──
    const baseItems = previousSync?.itemsSynced || existingPendingSync?.itemsSynced || [];
    const diffMap = {};
    baseItems.forEach(item => {
      const key = `${item.design}-${item.color}`;
      diffMap[key] = { design: item.design, color: item.color, before: item.quantities, after: null };
    });
    newItemsSynced.forEach(item => {
      const key = `${item.design}-${item.color}`;
      if (diffMap[key]) diffMap[key].after = item.quantities;
      else diffMap[key] = { design: item.design, color: item.color, before: null, after: item.quantities };
    });
    const structuredDiff = Object.values(diffMap);

    // ── STEP 4: If pending exists, update it in place ──
    if (existingPendingSync) {
      console.log('🔄 SYNC-EDIT: Updating existing pending request in place:', existingPendingSync._id);

      existingPendingSync.syncType    = 'edit';
      existingPendingSync.itemsSynced = newItemsSynced;
      existingPendingSync.changesMade = {
        diff: structuredDiff,
        previouslySyncedAt: previousSync?.syncedAt || null,
        editedAt: new Date()
      };
      existingPendingSync.metadata = {
        ...existingPendingSync.metadata,
        orderChallanNumber: order.challanNumber,
        orderTotalAmount:   order.totalAmount,
        orderDate:          order.createdAt,
        buyerName:          order.buyerName,
        supplierCompanyName,
        lastEditedAt:       new Date()
      };
      await existingPendingSync.save();

      try {
        const customerAdmins = await getOrgAdmins(customerTenantId);
        await Promise.all(customerAdmins.map(admin =>
          Notification.create({
            userId: admin._id,
            type: 'syncrequestupdated',
            title: 'Pending Sync Request Updated',
            message: `${supplierCompanyName} updated Order: ${order.challanNumber || 'N/A'} before you reviewed it. Please check the updated request.`,
            severity: 'warning',
            relatedId: existingPendingSync.id,
            relatedModel: 'SupplierSync',
            organizationId: customerTenantId
          })
        ));
      } catch (notifError) {
        console.warn('Update notification failed', notifError.message);
      }

      console.log('✅ SYNC-EDIT: Existing pending request updated');
      return {
        synced: false,
        pending: true,
        updated: true,
        syncRequestId: existingPendingSync._id,
        message: 'Existing pending request updated with new quantities'
      };
    }

    // ── STEP 5: No pending exists — need previousSync for manual/direct flow ──
    if (!previousSync) {
      console.log('🔄 SYNC-EDIT: No previous accepted sync and no pending request found');
      return { synced: false, reason: 'No previous sync found' };
    }

    // ══════════════════════════════════════════════════════
    // MANUAL MODE
    // ══════════════════════════════════════════════════════
    if (buyer?.syncPreference === 'manual') {
      console.log('📋 SYNC-EDIT: Manual mode, creating new pending edit request');

      const editSync = await SupplierSync.create({
        supplierTenantId,
        customerTenantId,
        wholesaleOrderId: order._id,
        syncType: 'edit',
        status: 'pending',
        itemsSynced: newItemsSynced,
        changesMade: {
          diff: structuredDiff,
          previouslySyncedAt: previousSync.syncedAt,
          editedAt: new Date()
        },
        editedWithin24Hours: true,
        metadata: {
          orderChallanNumber: order.challanNumber,
          orderTotalAmount:   order.totalAmount,
          orderDate:          order.createdAt,
          buyerName:          order.buyerName,
          supplierCompanyName
        }
      });

      await WholesaleOrder.findByIdAndUpdate(order._id, {
        syncStatus: 'pending',
        $push: {
          syncRequests: {
            requestId: editSync._id,
            sentAt: new Date(),
            status: 'pending'
          }
        }
      });

      try {
        const customerAdmins = await getOrgAdmins(customerTenantId);
        await Promise.all(customerAdmins.map(admin =>
          Notification.create({
            userId: admin._id,
            type: 'synceditrequest',
            title: 'Supplier Edited an Order',
            message: `${supplierCompanyName} made changes to Order: ${order.challanNumber || 'N/A'}. Review and accept or reject.`,
            severity: 'warning',
            relatedId: editSync.id,
            relatedModel: 'SupplierSync',
            organizationId: customerTenantId,
            metadata: { supplierName: supplierCompanyName, challanNumber: order.challanNumber, isEdit: true }
          })
        ));
      } catch (notifError) {
        console.warn('SYNC-EDIT: Notification failed', notifError.message);
      }

      console.log('✅ SYNC-EDIT: Pending edit request created:', editSync._id);
      return {
        synced: false,
        pending: true,
        syncRequestId: editSync._id,
        message: 'Edit sync request sent to customer for approval'
      };
    }

    // ══════════════════════════════════════════════════════
    // DIRECT MODE
    // ══════════════════════════════════════════════════════
    console.log('⚡ SYNC-EDIT: Direct mode, applying immediately');

    for (const item of previousSync.itemsSynced) {
      const product = await Product.findOne({ design: item.design, organizationId: customerTenantId });
      if (product) {
        const colorVariant = product.colors.find(c => c.color === item.color);
        if (colorVariant) {
          Object.entries(item.quantities).forEach(([size, qty]) => {
            const sizeStock = colorVariant.sizes.find(s => s.size === size);
            if (sizeStock) sizeStock.currentStock = Math.max(0, sizeStock.currentStock - qty);
          });
          await product.save();
        }
      }
    }

    await FactoryReceiving.deleteMany({ _id: { $in: previousSync.factoryReceivingIds } });

    const factoryReceivingIds = [];
    const itemsSyncedFinal = [];

    for (const key in itemGroups) {
      const item = itemGroups[key];
      const customerProduct = await Product.findOne({ design: item.design, organizationId: customerTenantId });
      if (!customerProduct) continue;

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
        supplierTenantId,
        supplierWholesaleOrderId: order._id,
        isReadOnly: true,
        supplierMetadata: { challanNumber: order.challanNumber, orderDate: order.createdAt, supplierCompanyName, isEdit: true },
        createdBy: { userId: customerUser._id, userName: 'System Auto-sync' }
      });

      const colorVariant = customerProduct.colors.find(c => c.color === item.color);
      if (colorVariant) {
        Object.entries(item.quantities).forEach(([size, qty]) => {
          const sizeStock = colorVariant.sizes.find(s => s.size === size);
          if (sizeStock) sizeStock.currentStock += qty;
        });
        await customerProduct.save();
      }

      factoryReceivingIds.push(factoryReceiving._id);
      itemsSyncedFinal.push({
        design: item.design,
        color: item.color,
        quantities: item.quantities,
        pricePerUnit: item.pricePerUnit
      });
    }

    await SupplierSync.create({
      supplierTenantId,
      customerTenantId,
      wholesaleOrderId: order._id,
      syncType: 'edit',
      itemsSynced: itemsSyncedFinal,
      factoryReceivingIds,
      status: 'synced',
      changesMade: {
        diff: structuredDiff,
        previouslySyncedAt: previousSync.syncedAt,
        editedAt: new Date(),
        ...(changesMade || {})
      },
      editedWithin24Hours: true,
      metadata: {
        orderChallanNumber: order.challanNumber,
        orderTotalAmount:   order.totalAmount,
        orderDate:          order.createdAt,
        buyerName:          order.buyerName
      }
    });

    console.log('✅ SYNC-EDIT: Direct sync complete');
    return { synced: true, itemsCount: itemsSyncedFinal.length, factoryReceivingIds };

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
    const {
      page     = 1,
      limit    = 20,
      search   = '',
      dateFrom = '',
      dateTo   = ''
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // ── Base filter ──
    const baseFilter = {
      organizationId: customerOrgId,
      sourceType    : 'supplier-sync'
    };

    // ── Date filter ──
    if (dateFrom || dateTo) {
      baseFilter.receivedDate = {};
      if (dateFrom) baseFilter.receivedDate.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        baseFilter.receivedDate.$lte = end;
      }
    }

    // ── Search filter ──
    if (search.trim()) {
      baseFilter.$or = [
        { sourceName : { $regex: search.trim(), $options: 'i' } },
        { batchId    : { $regex: search.trim(), $options: 'i' } },
        { 'supplierMetadata.challanNumber': { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // ── All-time stats (no filter) ──
    const [totalOrdersAll, totalUnitsAll, lastSyncRecord] = await Promise.all([
      FactoryReceiving.distinct('supplierWholesaleOrderId', {
        organizationId: customerOrgId,
        sourceType    : 'supplier-sync'
      }).then(ids => ids.length),

      FactoryReceiving.aggregate([
        { $match: { organizationId: customerOrgId, sourceType: 'supplier-sync' } },
        { $group: { _id: null, total: { $sum: '$totalQuantity' } } }
      ]).then(r => r[0]?.total || 0),

      FactoryReceiving.findOne({ organizationId: customerOrgId, sourceType: 'supplier-sync' })
        .sort({ receivedDate: -1 })
        .select('receivedDate')
        .lean()
    ]);

    // ── Fetch all matching receivings ──
    const allMatchingReceivings = await FactoryReceiving.find(baseFilter)
      .sort({ receivedDate: -1 })
      .lean();

    // ── Group by supplierWholesaleOrderId ──
    const groupedMap = allMatchingReceivings.reduce((acc, receiving) => {
      const orderId = receiving.supplierWholesaleOrderId?.toString() || receiving.batchId;
      if (!acc[orderId]) {
        acc[orderId] = {
          _id          : receiving._id,
          orderId,
          batchId      : receiving.batchId,
          challanNumber: receiving.supplierMetadata?.challanNumber || receiving.batchId,
          orderDate    : receiving.supplierMetadata?.orderDate     || receiving.receivedDate,
          supplierName : receiving.supplierMetadata?.supplierCompanyName || receiving.sourceName,
          receivedDate : receiving.receivedDate,
          receivedBy   : receiving.receivedBy,
          // Temp: use receivedBy as hint — will be overridden by SupplierSync lookup below
          acceptedBy   : (receiving.receivedBy && receiving.receivedBy !== 'System Auto-sync')
                           ? receiving.receivedBy
                           : (receiving.supplierMetadata?.acceptedBy || null),
          acceptedAt   : receiving.supplierMetadata?.acceptedAt || null,
          items        : [],
          totalQuantity: 0
        };
      }
      acc[orderId].items.push({
        design       : receiving.design,
        color        : receiving.color,
        quantities   : receiving.quantities instanceof Map
          ? Object.fromEntries(receiving.quantities)
          : receiving.quantities,
        totalQuantity: receiving.totalQuantity
      });
      acc[orderId].totalQuantity += receiving.totalQuantity;
      return acc;
    }, {});

    // ── ✅ FIX: Cross-reference SupplierSync as source of truth for acceptedBy ──
    // SupplierSync.approvedBy is always set on acceptSyncRequest — reliable even if
    // FactoryReceiving.supplierMetadata.acceptedBy is stripped by Mongoose schema
    const validOrderIds = Object.keys(groupedMap).filter(id => id && /^[a-f\d]{24}$/i.test(id));

    if (validOrderIds.length > 0) {
      const acceptedSyncs = await SupplierSync.find({
        wholesaleOrderId: { $in: validOrderIds },
        status          : 'accepted'
      }).select('wholesaleOrderId approvedBy').lean();

      acceptedSyncs.forEach(sync => {
        const key = sync.wholesaleOrderId?.toString();
        if (key && groupedMap[key] && sync.approvedBy?.userName) {
          groupedMap[key].acceptedBy = sync.approvedBy.userName;
          groupedMap[key].acceptedAt = sync.approvedBy.approvedAt || null;
        }
      });
    }

    // ── Paginate grouped orders ──
    const allOrders   = Object.values(groupedMap);
    const totalOrders = allOrders.length;
    const totalPages  = Math.ceil(totalOrders / parseInt(limit));

    const paginatedOrders = allOrders.slice(skip, skip + parseInt(limit));

    // ── Strip quantities from list (design chips only — lazy load on expand) ──
    const listOrders = paginatedOrders.map(o => ({
      _id          : o._id,
      orderId      : o.orderId,
      batchId      : o.batchId,
      challanNumber: o.challanNumber,
      orderDate    : o.orderDate,
      supplierName : o.supplierName,
      receivedDate : o.receivedDate,
      receivedBy   : o.receivedBy,
      acceptedBy   : o.acceptedBy,
      acceptedAt   : o.acceptedAt,
      totalQuantity: o.totalQuantity,
      items        : o.items.map(i => ({ design: i.design, color: i.color }))
    }));

    res.json({
      success: true,
      data: {
        orders        : listOrders,
        totalOrders   : totalOrders,
        totalPages,
        totalOrdersAll: totalOrdersAll,
        totalUnits    : totalUnitsAll,
        lastSyncDate  : lastSyncRecord?.receivedDate || null
      }
    });

  } catch (error) {
    console.error('Error in getReceivedFromSupplier:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch received orders', error: error.message });
  }
};

exports.getReceivedOrderDetail = async (req, res) => {
  try {
    const customerOrgId = req.user.organizationId;
    const { orderId }   = req.params;  // supplierWholesaleOrderId or batchId

    // Fetch all receivings for this order
    const receivings = await FactoryReceiving.find({
      organizationId: customerOrgId,
      sourceType    : 'supplier-sync',
      $or: [
        { supplierWholesaleOrderId: orderId },
        { batchId: orderId }
      ]
    }).lean();

    if (!receivings.length) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Build full detail with quantities
    const first = receivings[0];
    const detail = {
      orderId      : orderId,
      batchId      : first.batchId,
      challanNumber: first.supplierMetadata?.challanNumber || first.batchId,
      orderDate    : first.supplierMetadata?.orderDate || first.receivedDate,
      supplierName : first.supplierMetadata?.supplierCompanyName || first.sourceName,
      receivedDate : first.receivedDate,
      receivedBy   : first.receivedBy,
      acceptedBy   : first.supplierMetadata?.acceptedBy,
      totalQuantity: receivings.reduce((sum, r) => sum + r.totalQuantity, 0),
      items        : receivings.map(r => ({
        design       : r.design,
        color        : r.color,
        quantities   : r.quantities instanceof Map
          ? Object.fromEntries(r.quantities)
          : r.quantities,
        totalQuantity: r.totalQuantity
      }))
    };

    res.json({ success: true, data: detail });

  } catch (error) {
    console.error('Error in getReceivedOrderDetail:', error);
    res.status(500).json({ success: false, message: error.message });
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
  getReceivedFromSupplier: exports.getReceivedFromSupplier,
  getReceivedOrderDetail: exports.getReceivedOrderDetail
};
