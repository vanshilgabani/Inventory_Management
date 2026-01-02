const MarketplaceSale = require('../models/MarketplaceSale');
const Product = require('../models/Product');
const Settings = require('../models/Settings');
const Transfer = require('../models/Transfer');
const logger = require('../utils/logger');
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
// Create marketplace sale with reserved stock validation
exports.createSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { 
      accountName, 
      marketplaceOrderId, 
      design, 
      color, 
      size, 
      quantity, 
      saleDate, 
      status, 
      notes 
    } = req.body;
    const { organizationId, id: userId } = req.user;

    // Validation
    if (!accountName || !design || !color || !size || !quantity) {
      await session.abortTransaction();
      return res.status(400).json({ 
        code: 'INVALID_DATA', 
        message: 'Required fields missing' 
      });
    }

    // Find product
    const product = await Product.findOne({ design, organizationId }).session(session);
    if (!product) {
      await session.abortTransaction();
      return res.status(404).json({ 
        code: 'PRODUCT_NOT_FOUND', 
        message: `Product ${design} not found` 
      });
    }

    // Find variant
    const colorVariant = product.colors.find(c => c.color === color);
    if (!colorVariant) {
      await session.abortTransaction();
      return res.status(404).json({ 
        code: 'COLOR_NOT_FOUND', 
        message: `Color ${color} not found` 
      });
    }

    const sizeIndex = colorVariant.sizes.findIndex(s => s.size === size);
    if (sizeIndex === -1) {
      await session.abortTransaction();
      return res.status(404).json({ 
        code: 'SIZE_NOT_FOUND', 
        message: `Size ${size} not found` 
      });
    }

    const sizeVariant = colorVariant.sizes[sizeIndex];
    const reservedStock = sizeVariant.reservedStock || 0;
    const mainStock = sizeVariant.currentStock || 0;

    // ✅ NEW LOGIC: Check reserved stock first
    if (reservedStock < quantity) {
      const deficit = quantity - reservedStock;
      
      // Check if main inventory has enough to cover deficit
      if (mainStock < deficit) {
        await session.abortTransaction();
        return res.status(400).json({
          code: 'INSUFFICIENT_STOCK',
          message: `Insufficient stock. Reserved: ${reservedStock}, Main: ${mainStock}, Need: ${quantity}`,
          variant: { design, color, size },
          reservedStock,
          mainStock,
          required: quantity,
          deficit
        });
      }

      // ⚠️ Need to use main stock - send popup trigger
      await session.abortTransaction();
      return res.status(400).json({
        code: 'RESERVED_INSUFFICIENT_USE_MAIN',
        message: `Reserved stock insufficient. Need ${deficit} units from main inventory.`,
        variant: { design, color, size },
        reservedStock,
        mainStock,
        required: quantity,
        deficit,
        canUseMain: true // Flag to show popup
      });
    }

    // Store snapshots
    const reservedBefore = sizeVariant.reservedStock;

    // ✅ Sufficient reserved stock - proceed
    colorVariant.sizes[sizeIndex].reservedStock -= quantity;
    await product.save({ session });

    // Create sale
    const sale = await MarketplaceSale.create([{
      accountName,
      marketplaceOrderId: marketplaceOrderId || `MP-${Date.now()}`,
      design,
      color,
      size,
      quantity,
      saleDate: saleDate || new Date(),
      status: status || 'dispatched',
      notes,
      organizationId,
      createdBy: userId
    }], { session });

    // Log transfer (reserved stock used)
    await Transfer.create([{
      design,
      color,
      size,
      quantity,
      type: 'marketplace_order',
      from: 'reserved',
      to: 'sold',
      mainStockBefore: sizeVariant.currentStock,
      reservedStockBefore: reservedBefore,
      mainStockAfter: sizeVariant.currentStock,
      reservedStockAfter: sizeVariant.reservedStock,
      relatedOrderId: sale[0]._id,
      relatedOrderType: 'marketplace',
      performedBy: userId,
      notes: `Marketplace order ${marketplaceOrderId || 'created'}`,
      organizationId
    }], { session });

    await session.commitTransaction();

    logger.info('Marketplace sale created', { 
      saleId: sale[0]._id, 
      design, color, size, quantity 
    });

    res.status(201).json({
      success: true,
      data: sale[0]
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Sale creation failed', { error: error.message });
    res.status(500).json({ 
      code: 'SALE_CREATION_FAILED', 
      message: 'Failed to create sale', 
      error: error.message 
    });
  } finally {
    session.endSession();
  }
};

exports.createSaleWithMainStock = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { accountName, marketplaceOrderId, design, color, size, quantity, saleDate, status, notes, useMainStock } = req.body;
    const { organizationId, id: userId } = req.user;

    // ✅ Validate flag first
    if (!useMainStock) {
      await session.abortTransaction();
      return res.status(400).json({ code: 'CONFIRMATION_REQUIRED', message: 'Main stock usage confirmation required' });
    }

    // Find product
    const product = await Product.findOne({ design, organizationId }).session(session);
    if (!product) {
      await session.abortTransaction();
      return res.status(404).json({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found' });
    }

    const colorVariant = product.colors.find((c) => c.color === color);
    const sizeIndex = colorVariant?.sizes.findIndex((s) => s.size === size);
    
    if (!colorVariant || sizeIndex === -1) {
      await session.abortTransaction();
      return res.status(404).json({ code: 'VARIANT_NOT_FOUND', message: 'Variant not found' });
    }

    const sizeVariant = colorVariant.sizes[sizeIndex];
    const reservedStock = sizeVariant.reservedStock || 0;
    const mainStock = sizeVariant.currentStock || 0;
    const deficit = quantity - reservedStock;

    // ✅ Validate BEFORE any database changes
    if (deficit > 0 && mainStock < deficit) {
      await session.abortTransaction();
      return res.status(400).json({
        code: 'INSUFFICIENT_MAIN_STOCK',
        message: `Main stock insufficient. Available: ${mainStock}, Need: ${deficit}`,
        available: mainStock,
        needed: deficit
      });
    }

    // Store snapshots
    const mainBefore = sizeVariant.currentStock;
    const reservedBefore = sizeVariant.reservedStock;

    // Use reserved first, then main
    if (reservedStock > 0) {
      colorVariant.sizes[sizeIndex].reservedStock = 0;
    }
    colorVariant.sizes[sizeIndex].currentStock -= deficit;

    await product.save({ session });

    // Create sale
    const sale = await MarketplaceSale.create([{
      accountName,
      marketplaceOrderId: marketplaceOrderId || `MP-${Date.now()}`,
      design,
      color,
      size,
      quantity,
      saleDate: saleDate || new Date(),
      status: status || 'dispatched',
      notes: notes ? `${notes} [Used main stock]` : '[Used main stock]',
      organizationId,
      createdBy: userId
    }], { session });

    // Log transfers
    if (reservedStock > 0) {
      // Log reserved stock usage
      await Transfer.create([{
        design, color, size,
        quantity: reservedStock,
        type: 'marketplace_order',
        from: 'reserved',
        to: 'sold',
        mainStockBefore: mainBefore,
        reservedStockBefore: reservedBefore,
        mainStockAfter: mainBefore,
        reservedStockAfter: 0,
        relatedOrderId: sale[0]._id,
        relatedOrderType: 'marketplace',
        performedBy: userId,
        notes: `Marketplace order - reserved portion`,
        organizationId
      }], { session });
    }

    // Log emergency main stock usage
    await Transfer.create([{
      design, color, size,
      quantity: deficit,
      type: 'emergency_use',
      from: 'main',
      to: 'sold',
      mainStockBefore: mainBefore,
      reservedStockBefore: reservedBefore,
      mainStockAfter: sizeVariant.currentStock,
      reservedStockAfter: 0,
      relatedOrderId: sale[0]._id,
      relatedOrderType: 'marketplace',
      performedBy: userId,
      notes: `Emergency use of main stock for marketplace order`,
      organizationId
    }], { session });

    await session.commitTransaction();

    logger.info('Marketplace sale created with main stock', { 
      saleId: sale[0]._id, 
      usedReserved: reservedStock,
      usedMain: deficit
    });

    res.status(201).json({
      success: true,
      data: {
        ...sale[0].toObject(),
        usedMainStock: true,
        breakdown: {
          fromReserved: reservedStock,
          fromMain: deficit,
        },
      }
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Sale with main stock failed', { error: error.message });
    res.status(500).json({ 
      code: 'SALE_CREATION_FAILED', 
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

        // ✅ NEW BULLETPROOF LOGIC - Handle stock changes based on status transition
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
              if (typeof sizeVariant.currentStock === 'undefined' || 
                  sizeVariant.currentStock === null || 
                  isNaN(sizeVariant.currentStock)) {
                console.warn(`⚠️ Stock was undefined for ${sale.design}-${sale.color}-${sale.size}, initializing to 0`);
                sizeVariant.currentStock = 0;
              }

              // ✅ Define status categories
              const stockRestoringStatuses = ['returned', 'cancelled'];
              const stockDeductingStatuses = ['delivered', 'dispatched'];
              const noStockChangeStatuses = ['wrong_return'];

              const oldStatusType = stockRestoringStatuses.includes(oldStatus) ? 'restoring' :
                                  stockDeductingStatuses.includes(oldStatus) ? 'deducting' :
                                  noStockChangeStatuses.includes(oldStatus) ? 'none' : 'unknown';

              const newStatusType = stockRestoringStatuses.includes(status) ? 'restoring' :
                                  stockDeductingStatuses.includes(status) ? 'deducting' :
                                  noStockChangeStatuses.includes(status) ? 'none' : 'unknown';

              console.log(`📊 Status transition: ${oldStatus} (${oldStatusType}) → ${status} (${newStatusType})`);
              console.log(`📦 Stock restored amount tracked: ${sale.stockRestoredAmount || 0}`);

                // ✅ SCENARIO 1: Moving TO restoring status (returned/cancelled)
                if (newStatusType === 'restoring') {
                  // Only restore if stock wasn't already restored
                  if ((sale.stockRestoredAmount || 0) === 0) {
                    console.log(`✅ Restoring stock to RESERVED: +${sale.quantity}`);
                    
                    // ✅ RESTORE TO RESERVED STOCK, NOT MAIN
                    sizeVariant.reservedStock = (sizeVariant.reservedStock || 0) + sale.quantity;
                    
                    sale.stockRestoredAmount = sale.quantity;
                    stockRestored = sale.quantity;
                    await product.save({ session });
                  } else {
                    console.log(`⚠️ Stock already restored (${sale.stockRestoredAmount}), no change`);
                  }
                }

                // ✅ SCENARIO 2: Moving FROM restoring status TO deducting/none
                else if (oldStatusType === 'restoring' && (newStatusType === 'deducting' || newStatusType === 'none')) {
                  // Deduct back the previously restored stock FROM RESERVED
                  if ((sale.stockRestoredAmount || 0) > 0) {
                    const amountToDeduct = sale.stockRestoredAmount;
                    
                    // ✅ Check reserved stock (not main stock)
                    const availableReserved = sizeVariant.reservedStock || 0;
                    if (availableReserved < amountToDeduct) {
                      await session.abortTransaction();
                      return res.status(400).json({
                        success: false,
                        message: `Insufficient reserved stock. Available: ${availableReserved}, Required: ${amountToDeduct}`
                      });
                    }

                    console.log(`🔄 Undoing stock restoration from RESERVED: -${amountToDeduct}`);
                    sizeVariant.reservedStock -= amountToDeduct;
                    
                    sale.stockRestoredAmount = 0;
                    stockDeducted = amountToDeduct;
                    await product.save({ session });
                  } else {
                    console.log(`⚠️ No stock was restored previously, no deduction needed`);
                  }
                }

                // ✅ SCENARIO 3: Moving TO wrong_return from restoring status
                else if (newStatusType === 'none' && oldStatusType === 'restoring') {
                  // Same as scenario 2 - undo restoration FROM RESERVED
                  if ((sale.stockRestoredAmount || 0) > 0) {
                    const amountToDeduct = sale.stockRestoredAmount;
                    
                    const availableReserved = sizeVariant.reservedStock || 0;
                    if (availableReserved < amountToDeduct) {
                      await session.abortTransaction();
                      return res.status(400).json({
                        success: false,
                        message: `Insufficient reserved stock. Available: ${availableReserved}, Required: ${amountToDeduct}`
                      });
                    }

                    console.log(`🔄 Wrong return - undoing restoration from RESERVED: -${amountToDeduct}`);
                    sizeVariant.reservedStock -= amountToDeduct;
                    
                    sale.stockRestoredAmount = 0;
                    stockDeducted = amountToDeduct;
                    await product.save({ session });
                  }
                }

                // ✅ SCENARIO 4: All other transitions
                else {
                  console.log(`⚠️ No stock change needed for ${oldStatusType} → ${newStatusType}`);
                }
            } else {
              console.warn(`⚠️ Size ${sale.size} not found in product ${sale.design}-${sale.color}`);
            }
          } else {
            console.warn(`⚠️ Color ${sale.color} not found in product ${sale.design}`);
          }
        } else {
          console.warn(`⚠️ Product ${sale.design} not found`);
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

        // ✅ SAME BULLETPROOF LOGIC for salesperson
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
              if (typeof sizeVariant.currentStock === 'undefined' || 
                  sizeVariant.currentStock === null || 
                  isNaN(sizeVariant.currentStock)) {
                console.warn(`⚠️ Stock was undefined for ${sale.design}-${sale.color}-${sale.size}, initializing to 0`);
                sizeVariant.currentStock = 0;
              }

              // ✅ Define status categories
              const stockRestoringStatuses = ['returned', 'cancelled'];
              const stockDeductingStatuses = ['delivered', 'dispatched'];
              const noStockChangeStatuses = ['wrong_return'];

              const oldStatusType = stockRestoringStatuses.includes(oldStatus) ? 'restoring' :
                                  stockDeductingStatuses.includes(oldStatus) ? 'deducting' :
                                  noStockChangeStatuses.includes(oldStatus) ? 'none' : 'unknown';

              const newStatusType = stockRestoringStatuses.includes(status) ? 'restoring' :
                                  stockDeductingStatuses.includes(status) ? 'deducting' :
                                  noStockChangeStatuses.includes(status) ? 'none' : 'unknown';

              console.log(`📊 Status transition: ${oldStatus} (${oldStatusType}) → ${status} (${newStatusType})`);
              console.log(`📦 Stock restored amount tracked: ${sale.stockRestoredAmount || 0}`);

              // ✅ SCENARIO 1: Moving TO restoring status (returned/cancelled)
              if (newStatusType === 'restoring') {
                if ((sale.stockRestoredAmount || 0) === 0) {
                  console.log(`✅ Restoring stock to RESERVED: +${sale.quantity}`);
                  
                  // ✅ RESTORE TO RESERVED STOCK
                  sizeVariant.reservedStock = (sizeVariant.reservedStock || 0) + sale.quantity;
                  
                  sale.stockRestoredAmount = sale.quantity;
                  stockRestored = sale.quantity;
                  await product.save({ session });
                } else {
                  console.log(`⚠️ Stock already restored, no change`);
                }
              }

              // ✅ SCENARIO 2: Moving FROM restoring TO deducting/none
              else if (oldStatusType === 'restoring' && (newStatusType === 'deducting' || newStatusType === 'none')) {
                if ((sale.stockRestoredAmount || 0) > 0) {
                  const amountToDeduct = sale.stockRestoredAmount;
                  
                  const availableReserved = sizeVariant.reservedStock || 0;
                  if (availableReserved < amountToDeduct) {
                    await session.abortTransaction();
                    return res.status(400).json({
                      success: false,
                      message: `Insufficient reserved stock. Available: ${availableReserved}, Required: ${amountToDeduct}`
                    });
                  }

                  console.log(`🔄 Undoing restoration from RESERVED: -${amountToDeduct}`);
                  sizeVariant.reservedStock -= amountToDeduct;
                  
                  sale.stockRestoredAmount = 0;
                  stockDeducted = amountToDeduct;
                  await product.save({ session });
                }
              }

              // ✅ SCENARIO 3: Moving TO wrong_return from restoring
              else if (newStatusType === 'none' && oldStatusType === 'restoring') {
                if ((sale.stockRestoredAmount || 0) > 0) {
                  const amountToDeduct = sale.stockRestoredAmount;
                  
                  const availableReserved = sizeVariant.reservedStock || 0;
                  if (availableReserved < amountToDeduct) {
                    await session.abortTransaction();
                    return res.status(400).json({
                      success: false,
                      message: `Insufficient reserved stock. Available: ${availableReserved}, Required: ${amountToDeduct}`
                    });
                  }

                  console.log(`🔄 Wrong return - undoing restoration from RESERVED: -${amountToDeduct}`);
                  sizeVariant.reservedStock -= amountToDeduct;
                  
                  sale.stockRestoredAmount = 0;
                  stockDeducted = amountToDeduct;
                  await product.save({ session });
                }
              }

              else {
                console.log(`⚠️ No stock change for ${oldStatusType} → ${newStatusType}`);
              }
            } else {
              console.warn(`⚠️ Size ${sale.size} not found`);
            }
          } else {
            console.warn(`⚠️ Color ${sale.color} not found`);
          }
        } else {
          console.warn(`⚠️ Product ${sale.design} not found`);
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

    // ✅ SMART RESTORE: Only restore if stock wasn't already restored
    const shouldRestoreStock = (sale.stockRestoredAmount || 0) === 0;
    
    if (shouldRestoreStock) {
      console.log(`🗑️ Deleting order - restoring stock to RESERVED: +${sale.quantity}`);
      
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
            // ✅ RESTORE TO RESERVED STOCK
            sizeVariant.reservedStock = (sizeVariant.reservedStock || 0) + sale.quantity;
            await product.save({ session });
            console.log(`✅ Stock restored to reserved: ${sale.quantity} units for ${sale.design}-${sale.color}-${sale.size}`);
          }
        }
      }
    } else {
      console.log(`🗑️ Deleting order - stock was already restored (${sale.stockRestoredAmount}), no action needed`);
    }

    await MarketplaceSale.deleteOne({ _id: id }).session(session);
    await session.commitTransaction();
    await decrementEditSession(req, 'delete', 'sales', req.params.id);

    res.json({
      success: true,
      message: shouldRestoreStock 
        ? 'Sale deleted and stock restored to reserved inventory' 
        : 'Sale deleted (stock was already restored)'
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
