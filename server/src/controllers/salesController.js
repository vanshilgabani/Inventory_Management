const MarketplaceSale = require('../models/MarketplaceSale');
const Product = require('../models/Product');
const Settings = require('../models/Settings');
const mongoose = require('mongoose');

// ✅ ADD THIS HELPER AT THE TOP OF EACH CONTROLLER FILE
const decrementEditSession = async (req, action, module, itemId) => {
  // Only decrement for salespeople with active sessions, not admins
  if (req.editSession && !req.isAdmin) {
    try {
      const session = req.editSession;
      session.remainingChanges -= 1;
      session.changesLog.push({
        action, // 'edit' or 'delete'
        module, // 'factory', 'inventory', 'sales', 'directSales'
        itemId: itemId || 'unknown',
        timestamp: new Date()
      });

      if (session.remainingChanges <= 0) {
        session.isActive = false;
      }

      await session.save();
      console.log(`✅ Session decremented: ${session.remainingChanges} changes left for user ${req.user.name}`);
    } catch (error) {
      console.error('Failed to decrement session:', error);
    }
  }
};


/**
 * Valid statuses (removed 'upcoming')
 */
const VALID_STATUSES = ['dispatched', 'delivered', 'returned', 'wrong_return', 'cancelled'];

/**
 * Create new marketplace sale
 * Default status: dispatched
 */
exports.createSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { accountName, saleDate, marketplaceOrderId, design, color, size, quantity, notes } = req.body;
    const organizationId = req.user.organizationId;

    // Find product
    const product = await Product.findOne({ 
      organizationId, 
      design,
      'colors.color': color 
    }).session(session);

    if (!product) {
      await session.abortTransaction();
      return res.status(404).json({ 
        success: false, 
        message: `Product ${design} with color ${color} not found` 
      });
    }

    const colorVariant = product.colors.find(c => c.color === color);
    const sizeVariant = colorVariant.sizes.find(s => s.size === size);

    if (!sizeVariant) {
      await session.abortTransaction();
      return res.status(404).json({ 
        success: false, 
        message: `Size ${size} not found` 
      });
    }

    // ✅ Get stock lock settings
    const settings = await Settings.findOne({ organizationId }).session(session);
    const stockLockEnabled = settings?.stockLockEnabled || false;

    // ✅ Check locked stock availability from DATABASE
    if (stockLockEnabled) {
      const currentLockedStock = sizeVariant.lockedStock || 0;
      const maxThreshold = settings?.maxStockLockThreshold || 0;
      const availableForLock = sizeVariant.currentStock - currentLockedStock;

      // ✅ If locked stock is 0, show refill popup
      if (currentLockedStock === 0) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          code: 'LOCK_EMPTY_REFILL_NEEDED',
          message: `No locked stock for ${design}-${color}-${size}. Please refill from available stock.`,
          variant: { design, color, size },
          currentStock: sizeVariant.currentStock,
          lockedStock: 0,
          availableForLock: availableForLock,
          maxThreshold: maxThreshold,
        });
      }

      // ✅ Check if sufficient locked stock
      if (currentLockedStock < quantity) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          code: 'INSUFFICIENT_LOCKED_STOCK',
          message: `Insufficient locked stock for ${design}-${color}-${size}. Available in lock: ${currentLockedStock}, Requested: ${quantity}`,
          variant: { design, color, size },
          lockedStock: currentLockedStock,
          requested: quantity,
          availableForLock: availableForLock,
          maxThreshold: maxThreshold,
        });
      }

      // ✅ Deduct from BOTH lockedStock and currentStock
      sizeVariant.lockedStock -= quantity;
      sizeVariant.currentStock -= quantity;
    } else {
      // No stock lock enabled, deduct from current stock only
      if (sizeVariant.currentStock < quantity) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Available: ${sizeVariant.currentStock}, Requested: ${quantity}`,
        });
      }

      sizeVariant.currentStock -= quantity;
    }

    await product.save({ session });

    // Create sale
    const newSale = new MarketplaceSale({
      organizationId,
      accountName,
      saleDate: new Date(saleDate),
      marketplaceOrderId: marketplaceOrderId || undefined,
      design,
      color,
      size,
      quantity,
      status: 'dispatched',
      notes,
      statusHistory: [{
        previousStatus: null,
        newStatus: 'dispatched',
        changedBy: {
          userId: req.user._id,
          userName: req.user.name || req.user.email,
          userRole: req.user.role,
        },
        changedAt: new Date(),
        comments: 'Order created with dispatched status',
      }],
    });

    await newSale.save({ session });
    await session.commitTransaction();

    res.status(201).json({ 
      success: true, 
      data: newSale,
      stockDeducted: quantity,
      fromLockedStock: stockLockEnabled,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Create sale error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create sale', 
      error: error.message 
    });
  } finally {
    session.endSession();
  }
};


/**
 * Get all sales with filtering
 */
exports.getAllSales = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { 
      status, 
      accountName, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 0 
    } = req.query;

    const filter = { organizationId };

    // Status filter - support multiple statuses
    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      filter.status = { $in: statuses };
    }

    if (accountName && accountName !== 'all') {
      filter.accountName = accountName;
    }

    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.saleDate.$lte = end;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [sales, total] = await Promise.all([
      MarketplaceSale.find(filter)
        .sort({ saleDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      MarketplaceSale.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: sales,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales',
      error: error.message
    });
  }
};

/**
 * Get sales statistics
 */
exports.getSalesStats = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { accountName, startDate, endDate } = req.query;

    const filter = { organizationId };

    if (accountName && accountName !== 'all') {
      filter.accountName = accountName;
    }

    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.saleDate.$lte = end;
      }
    }

    const stats = await MarketplaceSale.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' }
        }
      }
    ]);

    const total = await MarketplaceSale.countDocuments(filter);

    // Only 5 statuses
    const statusCounts = {
      dispatched: 0,
      delivered: 0,
      returned: 0,
      wrong_return: 0,
      cancelled: 0
    };

    stats.forEach(stat => {
      if (statusCounts.hasOwnProperty(stat._id)) {
        statusCounts[stat._id] = stat.count;
      }
    });

    res.json({
      success: true,
      data: {
        total,
        ...statusCounts
      }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
};

/**
 * Get single sale by ID
 */
exports.getSaleById = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const sale = await MarketplaceSale.findOne({
      _id: id,
      organizationId
    }).lean();

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    res.json({
      success: true,
      data: sale
    });

  } catch (error) {
    console.error('Get sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sale',
      error: error.message
    });
  }
};

/**
 * Update sale
 * Sales person: Can only update status
 * Admin: Can update all fields
 */
exports.updateSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;
    const userRole = req.user.role;

    const sale = await MarketplaceSale.findOne({
      _id: id,
      organizationId
    }).session(session);

    if (!sale) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    const oldStatus = sale.status;
    const oldQuantity = sale.quantity;
    const oldDesign = sale.design;
    const oldColor = sale.color;
    const oldSize = sale.size;

    let stockRestored = 0;
    let stockDeducted = 0;

    // Role-based update logic
    if (userRole === 'admin') {
      // Admin can update everything
      const {
        accountName,
        saleDate,
        marketplaceOrderId,
        design,
        color,
        size,
        quantity,
        status,
        notes,
        comments,
        changedAt
      } = req.body;

      // If product details changed, handle stock
      if (design && color && size && (design !== oldDesign || color !== oldColor || size !== oldSize || quantity !== oldQuantity)) {
        // Restore old stock
        const oldProduct = await Product.findOne({
          organizationId,
          design: oldDesign,
          'colors.color': oldColor
        }).session(session);

        if (oldProduct) {
          const oldColorVariant = oldProduct.colors.find(c => c.color === oldColor);
          if (oldColorVariant) {
            const oldSizeVariant = oldColorVariant.sizes.find(s => s.size === oldSize);
            if (oldSizeVariant) {
              oldSizeVariant.currentStock = (oldSizeVariant.currentStock || 0) + oldQuantity;
              await oldProduct.save({ session });
              stockRestored = oldQuantity;
            }
          }
        }

        // Deduct new stock
        const newProduct = await Product.findOne({
          organizationId,
          design,
          'colors.color': color
        }).session(session);

        if (!newProduct) {
          await session.abortTransaction();
          return res.status(404).json({
            success: false,
            message: `Product ${design} with color ${color} not found`
          });
        }

        const newColorVariant = newProduct.colors.find(c => c.color === color);
        if (!newColorVariant) {
          await session.abortTransaction();
          return res.status(404).json({
            success: false,
            message: `Color ${color} not found`
          });
        }

        const newSizeVariant = newColorVariant.sizes.find(s => s.size === size);
        if (!newSizeVariant) {
          await session.abortTransaction();
          return res.status(404).json({
            success: false,
            message: `Size ${size} not found`
          });
        }

        const currentStock = newSizeVariant.currentStock || 0;
        if (currentStock < quantity) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: `Insufficient stock. Available: ${currentStock}`
          });
        }

        newSizeVariant.currentStock = currentStock - quantity;
        await newProduct.save({ session });
        stockDeducted = quantity;

        // Update sale details
        sale.design = design;
        sale.color = color;
        sale.size = size;
        sale.quantity = quantity;
      }

      // Update other fields
      if (accountName) sale.accountName = accountName;
      if (saleDate) sale.saleDate = new Date(saleDate);
      if (marketplaceOrderId !== undefined) sale.marketplaceOrderId = marketplaceOrderId;
      if (notes !== undefined) sale.notes = notes;

      // Update status - HANDLE STOCK HERE
      if (status && status !== oldStatus) {
        if (!VALID_STATUSES.includes(status)) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`
          });
        }

        // Handle stock changes based on status transition
        const product = await Product.findOne({
          organizationId,
          design: sale.design,
          'colors.color': sale.color
        }).session(session);

        if (product) {
          const colorVariant = product.colors.find(c => c.color === sale.color);
          if (colorVariant) {
            const sizeVariant = colorVariant.sizes.find(s => s.size === sale.size);
            if (sizeVariant) {
              // Initialize currentStock if undefined
              if (typeof sizeVariant.currentStock === 'undefined' || sizeVariant.currentStock === null || isNaN(sizeVariant.currentStock)) {
                console.warn(`⚠️  Stock was undefined for ${sale.design}-${sale.color}-${sale.size}, initializing to 0`);
                sizeVariant.currentStock = 0;
              }

              const stockRestoringStatuses = ['returned', 'cancelled', 'wrong_return'];
              const stockDeductingStatuses = ['delivered', 'dispatched'];

              const wasStockRestored = stockRestoringStatuses.includes(oldStatus);
              const shouldDeductStock = stockDeductingStatuses.includes(status);

              const wasStockDeducted = stockDeductingStatuses.includes(oldStatus);
              const shouldRestoreStock = stockRestoringStatuses.includes(status);

              if (wasStockRestored && shouldDeductStock) {
                // Stock was previously restored, now deduct it again
                if (sizeVariant.currentStock < sale.quantity) {
                  await session.abortTransaction();
                  return res.status(400).json({
                    success: false,
                    message: `Insufficient stock. Available: ${sizeVariant.currentStock}, Required: ${sale.quantity}`
                  });
                }
                console.log(`Before deduction: ${sizeVariant.currentStock}`);
                sizeVariant.currentStock -= sale.quantity;
                console.log(`After deduction: ${sizeVariant.currentStock}`);
                stockDeducted = sale.quantity;
                await product.save({ session });
                console.log(`✅ Stock deducted: ${sale.quantity} units for ${sale.design}-${sale.color}-${sale.size}`);
              } else if (wasStockDeducted && shouldRestoreStock) {
                // ✅ FIXED: Restore to lockedStock, not currentStock
                const settings = await Settings.findOne({ organizationId }).session(session);
                const stockLockEnabled = settings?.stockLockEnabled || false;
                
                console.log(`Before restoration: ${sizeVariant.currentStock}`);
                
                if (stockLockEnabled) {
                  sizeVariant.lockedStock = (sizeVariant.lockedStock || 0) + sale.quantity;
                  sizeVariant.currentStock += sale.quantity;
                  console.log(`✅ Stock restored to lock: ${sale.quantity} units for ${sale.design}-${sale.color}-${sale.size}`);
                } else {
                  sizeVariant.currentStock += sale.quantity;
                }
                
                console.log(`After restoration: ${sizeVariant.currentStock}`);
                stockRestored = sale.quantity;
                await product.save({ session });
                console.log(`✅ Stock restored: ${sale.quantity} units for ${sale.design}-${sale.color}-${sale.size}`);
              }
            } else {
              console.warn(`⚠️  Size ${sale.size} not found in product ${sale.design}-${sale.color}`);
            }
          } else {
            console.warn(`⚠️  Color ${sale.color} not found in product ${sale.design}`);
          }
        } else {
          console.warn(`⚠️  Product ${sale.design} not found`);
        }

        sale.statusHistory.push({
          previousStatus: oldStatus,
          newStatus: status,
          changedBy: {
            userId: req.user._id,
            userName: req.user.name || req.user.email,
            userRole: req.user.role
          },
          changedAt: changedAt ? new Date(changedAt) : new Date(),
          comments: comments || `Status updated by admin`
        });

        sale.status = status;
      }

    } else {
      // Sales person: Can only update status
      const { status, comments, changedAt } = req.body;

      if (!status) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }

      if (status === oldStatus) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'New status is same as current status'
        });
      }

      if (!VALID_STATUSES.includes(status)) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`
        });
      }

      // Handle stock changes based on status transition
      const product = await Product.findOne({
        organizationId,
        design: sale.design,
        'colors.color': sale.color
      }).session(session);

      if (product) {
        const colorVariant = product.colors.find(c => c.color === sale.color);
        if (colorVariant) {
          const sizeVariant = colorVariant.sizes.find(s => s.size === sale.size);
          if (sizeVariant) {
            // Initialize currentStock if undefined
            if (typeof sizeVariant.currentStock === 'undefined' || sizeVariant.currentStock === null || isNaN(sizeVariant.currentStock)) {
              console.warn(`⚠️  Stock was undefined for ${sale.design}-${sale.color}-${sale.size}, initializing to 0`);
              sizeVariant.currentStock = 0;
            }

            const stockRestoringStatuses = ['returned', 'cancelled', 'wrong_return'];
            const stockDeductingStatuses = ['delivered', 'dispatched'];

            const wasStockRestored = stockRestoringStatuses.includes(oldStatus);
            const shouldDeductStock = stockDeductingStatuses.includes(status);

            const wasStockDeducted = stockDeductingStatuses.includes(oldStatus);
            const shouldRestoreStock = stockRestoringStatuses.includes(status);

            if (wasStockRestored && shouldDeductStock) {
              // Stock was previously restored, now deduct it again
              if (sizeVariant.currentStock < sale.quantity) {
                await session.abortTransaction();
                return res.status(400).json({
                  success: false,
                  message: `Insufficient stock. Available: ${sizeVariant.currentStock}, Required: ${sale.quantity}`
                });
              }
              console.log(`Before deduction: ${sizeVariant.currentStock}`);
              sizeVariant.currentStock -= sale.quantity;
              console.log(`After deduction: ${sizeVariant.currentStock}`);
              stockDeducted = sale.quantity;
              await product.save({ session });
              console.log(`✅ Stock deducted: ${sale.quantity} units for ${sale.design}-${sale.color}-${sale.size}`);
            } else if (wasStockDeducted && shouldRestoreStock) {
              // Stock was previously deducted, now restore it
              console.log(`Before restoration: ${sizeVariant.currentStock}`);
              sizeVariant.currentStock += sale.quantity;
              console.log(`After restoration: ${sizeVariant.currentStock}`);
              stockRestored = sale.quantity;
              await product.save({ session });
              console.log(`✅ Stock restored: ${sale.quantity} units for ${sale.design}-${sale.color}-${sale.size}`);
            }
          } else {
            console.warn(`⚠️  Size ${sale.size} not found in product ${sale.design}-${sale.color}`);
          }
        } else {
          console.warn(`⚠️  Color ${sale.color} not found in product ${sale.design}`);
        }
      } else {
        console.warn(`⚠️  Product ${sale.design} not found`);
      }

      sale.statusHistory.push({
        previousStatus: oldStatus,
        newStatus: status,
        changedBy: {
          userId: req.user._id,
          userName: req.user.name || req.user.email,
          userRole: req.user.role
        },
        changedAt: changedAt ? new Date(changedAt) : new Date(),
        comments: comments || `Status updated to ${status}`
      });

      sale.status = status;
    }

    await sale.save({ session });
    await session.commitTransaction();
    await decrementEditSession(req, 'edit', 'sales', req.params.id);

    res.json({
      success: true,
      data: sale,
      stockRestored,
      stockDeducted
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Update sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update sale',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

/**
 * Delete sale (Admin only)
 */
exports.deleteSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const sale = await MarketplaceSale.findOne({
      _id: id,
      organizationId
    }).session(session);

    if (!sale) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Restore stock
    const product = await Product.findOne({
      organizationId,
      design: sale.design,
      'colors.color': sale.color
    }).session(session);

    if (product) {
      const colorVariant = product.colors.find(c => c.color === sale.color);
      if (colorVariant) {
        const sizeVariant = colorVariant.sizes.find(s => s.size === sale.size);
        if (sizeVariant) {
          // ✅ FIXED: Restore to lockedStock, not currentStock
          const settings = await Settings.findOne({ organizationId }).session(session);
          const stockLockEnabled = settings?.stockLockEnabled || false;
          
          if (stockLockEnabled) {
            sizeVariant.lockedStock = (sizeVariant.lockedStock || 0) + sale.quantity;
            sizeVariant.currentStock += sale.quantity;
            console.log(`✅ Stock restored to lock: ${sale.quantity} units for ${sale.design}-${sale.color}-${sale.size}`);
          } else {
            sizeVariant.currentStock += sale.quantity;
          }
          
          await product.save({ session });
        }
      }
    }

    await MarketplaceSale.deleteOne({ _id: id }).session(session);
    await session.commitTransaction();
    await decrementEditSession(req, 'delete', 'sales', req.params.id);

    res.json({
      success: true,
      message: 'Sale deleted and stock restored'
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Delete sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete sale',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

/**
 * Bulk mark as delivered
 */
exports.bulkMarkDelivered = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderIds, comments } = req.body;
    const organizationId = req.user.organizationId;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Order IDs array is required'
      });
    }

    const result = await MarketplaceSale.updateMany(
      {
        _id: { $in: orderIds },
        organizationId
      },
      {
        $set: { status: 'delivered' },
        $push: {
          statusHistory: {
            previousStatus: '$status',
            newStatus: 'delivered',
            changedBy: {
              userId: req.user._id,
              userName: req.user.name || req.user.email,
              userRole: req.user.role
            },
            changedAt: new Date(),
            comments: comments || 'Bulk marked as delivered'
          }
        }
      }
    ).session(session);

    await session.commitTransaction();

    res.json({
      success: true,
      message: `${result.modifiedCount} orders marked as delivered`,
      data: { updated: result.modifiedCount }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Bulk delivered error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark orders as delivered',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

/**
 * Export orders to CSV
 */
exports.exportOrders = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { status, accountName, startDate, endDate } = req.query;

    const filter = { organizationId };

    if (status && status !== 'all') {
      const statuses = status.split(',').map(s => s.trim());
      filter.status = { $in: statuses };
    }

    if (accountName && accountName !== 'all') {
      filter.accountName = accountName;
    }

    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.saleDate.$lte = end;
      }
    }

    const orders = await MarketplaceSale.find(filter)
      .sort({ saleDate: -1 })
      .lean();

    // Simple CSV export
    const csvRows = [];
    csvRows.push('Account,Date,Order ID,Design,Color,Size,Quantity,Status,Notes');

    orders.forEach(order => {
      csvRows.push([
        order.accountName,
        new Date(order.saleDate).toLocaleDateString(),
        order.marketplaceOrderId || '',
        order.design,
        order.color,
        order.size,
        order.quantity,
        order.status,
        order.notes || ''
      ].join(','));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
    res.send(csvRows.join('\n'));

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export orders',
      error: error.message
    });
  }
};
