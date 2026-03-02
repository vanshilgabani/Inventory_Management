const Transfer = require('../models/Transfer');
const Product = require('../models/Product');
const AllocationChange = require('../models/AllocationChange');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Get all transfers with filters
const getAllTransfers = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { type, design, color, size, startDate, endDate, limit = 100 } = req.query;

    const query = { organizationId };

    // Apply filters
    if (type) query.type = type;
    if (design) query.design = design;
    if (color) query.color = color;
    if (size) query.size = size;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transfers = await Transfer.find(query)
      .populate('performedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json(transfers);
  } catch (error) {
    logger.error('Failed to fetch transfers', { error: error.message });
    res.status(500).json({ 
      code: 'FETCH_FAILED', 
      message: 'Failed to fetch transfers', 
      error: error.message 
    });
  }
};

// Get recent transfers (last 10)
const getRecentTransfers = async (req, res) => {
  try {
    const { organizationId } = req.user;

    const transfers = await Transfer.find({ organizationId })
      .populate('performedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.json(transfers);
  } catch (error) {
    logger.error('Failed to fetch recent transfers', { error: error.message });
    res.status(500).json({ 
      code: 'FETCH_FAILED', 
      message: 'Failed to fetch recent transfers', 
      error: error.message 
    });
  }
};

// Manual transfer: Main → Reserved (Refill)
const transferToReserved = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { organizationId, id: userId } = req.user;
    const { design, color, size, quantity, notes } = req.body;

    if (!quantity || quantity <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ 
        code: 'INVALID_QUANTITY', 
        message: 'Quantity must be greater than 0' 
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

    const sizeVariant = colorVariant.sizes.find(s => s.size === size);
    if (!sizeVariant) {
      await session.abortTransaction();
      return res.status(404).json({ 
        code: 'SIZE_NOT_FOUND', 
        message: `Size ${size} not found` 
      });
    }

    // Check main stock availability
    if (sizeVariant.currentStock < quantity) {
      await session.abortTransaction();
      return res.status(400).json({ 
        code: 'INSUFFICIENT_MAIN_STOCK', 
        message: `Insufficient main stock. Available: ${sizeVariant.currentStock}, Requested: ${quantity}` 
      });
    }

    // Store snapshots
    const mainBefore = sizeVariant.currentStock;
    const reservedBefore = sizeVariant.reservedStock || 0;

    // Update stocks
    sizeVariant.currentStock -= quantity;
    sizeVariant.reservedStock = (sizeVariant.reservedStock || 0) + quantity;

    await product.save({ session });

    // Log transfer
    const transfer = await Transfer.create([{
      design,
      color,
      size,
      quantity,
      type: 'manualrefill',
      from: 'main',
      to: 'reserved',
      mainStockBefore: mainBefore,
      reservedStockBefore: reservedBefore,
      mainStockAfter: sizeVariant.currentStock,
      reservedStockAfter: sizeVariant.reservedStock,
      performedBy: userId,
      notes,
      organizationId
    }], { session });

    await session.commitTransaction();

    logger.info('Transfer to reserved successful', { 
      design, color, size, quantity, transferId: transfer[0]._id 
    });

    res.json({
      success: true,
      message: `Transferred ${quantity} units to reserved inventory`,
      transfer: transfer[0],
      updatedStock: {
        mainStock: sizeVariant.currentStock,
        reservedStock: sizeVariant.reservedStock
      }
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Transfer to reserved failed', { error: error.message });
    res.status(500).json({ 
      code: 'TRANSFER_FAILED', 
      message: 'Failed to transfer stock', 
      error: error.message 
    });
  } finally {
    session.endSession();
  }
};

// Manual transfer: Reserved → Main (Return)
const transferToMain = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { organizationId, id: userId } = req.user;
    const { design, color, size, quantity, notes } = req.body;

    if (!quantity || quantity <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ 
        code: 'INVALID_QUANTITY', 
        message: 'Quantity must be greater than 0' 
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

    const sizeVariant = colorVariant.sizes.find(s => s.size === size);
    if (!sizeVariant) {
      await session.abortTransaction();
      return res.status(404).json({ 
        code: 'SIZE_NOT_FOUND', 
        message: `Size ${size} not found` 
      });
    }

    // Check reserved stock availability
    const reservedStock = sizeVariant.reservedStock || 0;
    if (reservedStock < quantity) {
      await session.abortTransaction();
      return res.status(400).json({ 
        code: 'INSUFFICIENT_RESERVED_STOCK', 
        message: `Insufficient reserved stock. Available: ${reservedStock}, Requested: ${quantity}` 
      });
    }

    // Store snapshots
    const mainBefore = sizeVariant.currentStock;
    const reservedBefore = sizeVariant.reservedStock;

    // Update stocks
    sizeVariant.currentStock += quantity;
    sizeVariant.reservedStock -= quantity;

    await product.save({ session });

    // Log transfer
    const transfer = await Transfer.create([{
      design,
      color,
      size,
      quantity,
      type: 'manualreturn',
      from: 'reserved',
      to: 'main',
      mainStockBefore: mainBefore,
      reservedStockBefore: reservedBefore,
      mainStockAfter: sizeVariant.currentStock,
      reservedStockAfter: sizeVariant.reservedStock,
      performedBy: userId,
      notes,
      organizationId
    }], { session });

    await session.commitTransaction();

    logger.info('Transfer to main successful', { 
      design, color, size, quantity, transferId: transfer[0]._id 
    });

    res.json({
      success: true,
      message: `Transferred ${quantity} units back to main inventory`,
      transfer: transfer[0],
      updatedStock: {
        mainStock: sizeVariant.currentStock,
        reservedStock: sizeVariant.reservedStock
      }
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Transfer to main failed', { error: error.message });
    res.status(500).json({ 
      code: 'TRANSFER_FAILED', 
      message: 'Failed to transfer stock', 
      error: error.message 
    });
  } finally {
    session.endSession();
  }
};

// Bulk transfer to reserved (for entire design or specific variants)
const bulkTransferToReserved = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { organizationId, id: userId } = req.user;
    const { transfers, notes } = req.body; // transfers = [{ design, color, size, quantity }]

    if (!Array.isArray(transfers) || transfers.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ 
        code: 'INVALID_DATA', 
        message: 'Transfers array is required' 
      });
    }

    const results = [];
    const transferLogs = [];

    for (const item of transfers) {
      const { design, color, size, quantity } = item;

      if (!quantity || quantity <= 0) continue;

      // Find product
      const product = await Product.findOne({ design, organizationId }).session(session);
      if (!product) {
        results.push({ design, color, size, success: false, error: 'Product not found' });
        continue;
      }

      // Find variant
      const colorVariant = product.colors.find(c => c.color === color);
      const sizeVariant = colorVariant?.sizes.find(s => s.size === size);

      if (!sizeVariant) {
        results.push({ design, color, size, success: false, error: 'Variant not found' });
        continue;
      }

      // Check stock
      if (sizeVariant.currentStock < quantity) {
        results.push({ 
          design, color, size, success: false, 
          error: `Insufficient stock. Available: ${sizeVariant.currentStock}` 
        });
        continue;
      }

      // Store snapshots
      const mainBefore = sizeVariant.currentStock;
      const reservedBefore = sizeVariant.reservedStock || 0;

      // Update stocks
      sizeVariant.currentStock -= quantity;
      sizeVariant.reservedStock = (sizeVariant.reservedStock || 0) + quantity;

      await product.save({ session });

      // Prepare transfer log
      transferLogs.push({
        design,
        color,
        size,
        quantity,
        type: 'manualrefill',
        from: 'main',
        to: 'reserved',
        mainStockBefore: mainBefore,
        reservedStockBefore: reservedBefore,
        mainStockAfter: sizeVariant.currentStock,
        reservedStockAfter: sizeVariant.reservedStock,
        performedBy: userId,
        notes: notes || `Bulk transfer`,
        organizationId
      });

      results.push({ 
        design, color, size, quantity, success: true,
        mainStock: sizeVariant.currentStock,
        reservedStock: sizeVariant.reservedStock
      });
    }

    // Insert all transfer logs
    if (transferLogs.length > 0) {
      await Transfer.insertMany(transferLogs, { session });
    }

    await session.commitTransaction();

    const successCount = results.filter(r => r.success).length;
    
    logger.info('Bulk transfer completed', { 
      total: transfers.length, 
      success: successCount, 
      failed: transfers.length - successCount 
    });

    res.json({
      success: true,
      message: `Bulk transfer completed. ${successCount}/${transfers.length} successful`,
      results
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Bulk transfer failed', { error: error.message });
    res.status(500).json({ 
      code: 'BULK_TRANSFER_FAILED', 
      message: 'Failed to complete bulk transfer', 
      error: error.message 
    });
  } finally {
    session.endSession();
  }
};

// Bulk transfer to main (for returns) - WITH PER-ACCOUNT SUPPORT
const bulkTransferToMain = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { organizationId, id: userId } = req.user;
    const { transfers, notes } = req.body; // transfers = [{ design, color, size, accountReturns: [{accountName, quantity}] }]

    if (!Array.isArray(transfers) || transfers.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        code: 'INVALID_DATA',
        message: 'Transfers array is required'
      });
    }

    const results = [];
    const transferLogs = [];
    const allocationChanges = [];

    for (const item of transfers) {
      const { design, color, size, accountReturns } = item;
      
      // Skip if no account returns
      if (!accountReturns || accountReturns.length === 0) continue;

      // Calculate total quantity
      const totalQuantity = accountReturns.reduce((sum, ar) => sum + (ar.quantity || 0), 0);
      if (totalQuantity <= 0) continue;

      // Find product
      const product = await Product.findOne({ design, organizationId }).session(session);
      if (!product) {
        results.push({ design, color, size, success: false, error: 'Product not found' });
        continue;
      }

      // Find variant
      const colorVariant = product.colors.find(c => c.color === color);
      const sizeVariant = colorVariant?.sizes.find(s => s.size === size);
      if (!sizeVariant) {
        results.push({ design, color, size, success: false, error: 'Variant not found' });
        continue;
      }

      // Validate and process each account return
      let hasError = false;
      let errorMessage = '';

      for (const accountReturn of accountReturns) {
        const { accountName, quantity } = accountReturn;
        if (!quantity || quantity <= 0) continue;

        // Find allocation for this account
        const allocation = sizeVariant.reservedAllocations?.find(
          a => a.accountName === accountName
        );

        if (!allocation) {
          hasError = true;
          errorMessage = `No allocation found for account: ${accountName}`;
          break;
        }

        if (allocation.quantity < quantity) {
          hasError = true;
          errorMessage = `Insufficient stock in ${accountName}. Available: ${allocation.quantity}, Requested: ${quantity}`;
          break;
        }
      }

      if (hasError) {
        results.push({ design, color, size, success: false, error: errorMessage });
        continue;
      }

      // Store snapshots
      const mainBefore = sizeVariant.currentStock;
      const reservedBefore = sizeVariant.reservedStock;

      // Process returns for each account
      for (const accountReturn of accountReturns) {
        const { accountName, quantity } = accountReturn;
        if (!quantity || quantity <= 0) continue;

        // Find and update allocation
        const allocation = sizeVariant.reservedAllocations.find(
          a => a.accountName === accountName
        );

        const quantityBefore = allocation.quantity;
        const quantityAfter = quantityBefore - quantity;

        allocation.quantity = quantityAfter;
        allocation.updatedAt = new Date();

        // Log allocation change
        allocationChanges.push({
          productId: product._id,
          design: product.design,
          color: color,
          size: size,
          accountName: accountName,
          quantityBefore: quantityBefore,
          quantityAfter: quantityAfter,
          amountChanged: -quantity, // Negative = removed
          changeType: 'manualreturn',
          relatedOrderType: null,
          changedBy: userId,
          notes: notes || `Manual return from ${accountName} (${quantity} units)`,
          organizationId: organizationId
        });

        logger.info('Reduced allocation for return', {
          design, color, size,
          accountName,
          before: quantityBefore,
          after: quantityAfter,
          returned: quantity
        });
      }

      // Update total stocks
      sizeVariant.currentStock += totalQuantity;
      sizeVariant.reservedStock -= totalQuantity;

      // Remove allocations with 0 quantity
      sizeVariant.reservedAllocations = sizeVariant.reservedAllocations.filter(
        alloc => alloc.quantity > 0
      );

      await product.save({ session });

      // Prepare transfer log (combined for all accounts)
      const accountsDetail = accountReturns
        .filter(ar => ar.quantity > 0)
        .map(ar => `${ar.accountName}(${ar.quantity})`)
        .join(', ');

      transferLogs.push({
        design,
        color,
        size,
        quantity: totalQuantity,
        type: 'manualreturn',
        from: 'reserved',
        to: 'main',
        mainStockBefore: mainBefore,
        reservedStockBefore: reservedBefore,
        mainStockAfter: sizeVariant.currentStock,
        reservedStockAfter: sizeVariant.reservedStock,
        performedBy: userId,
        notes: notes ? `${notes} - From: ${accountsDetail}` : `Bulk return from: ${accountsDetail}`,
        organizationId
      });

      results.push({
        design, color, size, 
        totalQuantity, 
        accountReturns,
        success: true,
        mainStock: sizeVariant.currentStock,
        reservedStock: sizeVariant.reservedStock
      });
    }

    // Insert all allocation changes
    if (allocationChanges.length > 0) {
      await AllocationChange.insertMany(allocationChanges, { session });
      logger.info('Allocation changes logged for bulk return', { count: allocationChanges.length });
    }

    // Insert all transfer logs
    if (transferLogs.length > 0) {
      await Transfer.insertMany(transferLogs, { session });
    }

    await session.commitTransaction();

    const successCount = results.filter(r => r.success).length;
    logger.info('Bulk return completed', {
      total: transfers.length,
      success: successCount,
      failed: transfers.length - successCount
    });

    res.json({
      success: true,
      message: `Bulk return completed. ${successCount}/${transfers.length} successful`,
      results
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Bulk return failed', { error: error.message });
    res.status(500).json({
      code: 'BULK_TRANSFER_FAILED',
      message: 'Failed to complete bulk return',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// Get transfer statistics with per-account breakdown from AllocationChange
const getTransferStats = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { month, year } = req.query;

    // Build date filter
    let dateFilter = {};
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);
      dateFilter = {
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      };
    } else if (year) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
      dateFilter = {
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      };
    }

    // ✅ PART 1: Calculate TOTAL stats from Transfer records (unchanged)
    const transfers = await Transfer.find({
      organizationId,
      ...dateFilter
    }).lean();

    const manualRefills = transfers
      .filter(t => t.type === 'manualrefill')
      .reduce((sum, t) => sum + t.quantity, 0);

    const emergencyUse = transfers
      .filter(t => t.type === 'emergencyuse')
      .reduce((sum, t) => sum + t.quantity, 0);

    const manualReturns = transfers
      .filter(t => t.type === 'manualreturn')
      .reduce((sum, t) => sum + t.quantity, 0);

    const emergencyBorrow = transfers
      .filter(t => t.type === 'emergencyborrow')
      .reduce((sum, t) => sum + t.quantity, 0);

    const totalTransferred = (manualRefills + emergencyUse) - (manualReturns + emergencyBorrow);

    const totalBreakdown = transfers
      .filter(t => t.type === 'manualrefill' || t.type === 'emergencyuse')
      .map(t => ({
        design: t.design,
        color: t.color,
        size: t.size,
        quantity: t.quantity,
        date: t.createdAt,
        type: t.type
      }));

    // ✅ PART 2: Calculate PER-ACCOUNT stats from AllocationChange
    const allocationChanges = await AllocationChange.find({
      organizationId,
      ...dateFilter
    }).lean();

    logger.info('Allocation changes found', { count: allocationChanges.length });

    // Group by account
    const accountStatsMap = {};

    allocationChanges.forEach(change => {
      const accountName = change.accountName;

      if (!accountStatsMap[accountName]) {
        accountStatsMap[accountName] = {
          accountName,
          allocated: 0,
          manualAllocations: 0,
          transfersIn: 0,
          transfersOut: 0,
          returns: 0,
          borrows: 0,
          breakdown: {}
        };
      }

      const changeType = change.changeType;
      const amount = change.amountChanged; // ✅ This has the correct sign
      
      let shouldCount = false;

      if (changeType === 'manualallocation') {
        shouldCount = true;
        accountStatsMap[accountName].manualAllocations += amount;
      } else if (changeType === 'internal_transfer_in') {
        shouldCount = true;
        accountStatsMap[accountName].transfersIn += amount;
      } else if (changeType === 'internal_transfer_out') {
        shouldCount = true;
        accountStatsMap[accountName].transfersOut += Math.abs(amount);
      } else if (changeType === 'manualreturn') {
        shouldCount = true;
        accountStatsMap[accountName].returns += Math.abs(amount);
      } else if (changeType === 'emergencyborrow') {
        shouldCount = true;
        accountStatsMap[accountName].borrows += Math.abs(amount);
      }

      if (shouldCount) {
        // ✅ Net total (with correct signs)
        accountStatsMap[accountName].allocated += amount;

        // ✅ Breakdown aggregation (WITH CORRECT SIGNS)
        const key = `${change.design}|${change.color}|${change.size}`;
        if (!accountStatsMap[accountName].breakdown[key]) {
          accountStatsMap[accountName].breakdown[key] = {
            design: change.design,
            color: change.color,
            size: change.size,
            netQuantity: 0
          };
        }
        // ✅ CRITICAL: Use amount (which has correct sign), not Math.abs()
        accountStatsMap[accountName].breakdown[key].netQuantity += amount;
      }
    });

    // ✅ Convert to array with strict filtering
    const accountStats = Object.values(accountStatsMap).map(account => {
      const breakdownArray = Object.values(account.breakdown)
        .filter(item => item.netQuantity !== 0)
        .map(item => ({
          design: item.design,
          color: item.color,
          size: item.size,
          quantity: item.netQuantity // ✅ This MUST be signed value
        }));
      
      // ✅ DEBUG: Log the breakdown for verification
      logger.info('Account breakdown', {
        account: account.accountName,
        netTotal: account.allocated,
        stats: {
          allocated: account.manualAllocations,
          transfersIn: account.transfersIn,
          transfersOut: account.transfersOut,
          returns: account.returns,
          borrows: account.borrows
        },
        breakdownTotal: breakdownArray.reduce((sum, item) => sum + item.quantity, 0)
      });
      
      return {
        accountName: account.accountName,
        allocated: account.allocated,
        manualAllocations: account.manualAllocations,
        transfersIn: account.transfersIn,
        transfersOut: account.transfersOut,
        returns: account.returns,
        borrows: account.borrows,
        breakdown: breakdownArray
      };
    }).sort((a, b) => a.accountName.localeCompare(b.accountName));

    logger.info('Account stats calculated', { 
      accounts: accountStats.map(a => `${a.accountName}:${a.allocated}`).join(', ')
    });

    res.json({
      totalStats: {
        totalTransferred,
        manualRefills,
        emergencyUse,
        manualReturns,
        emergencyBorrow,
        breakdown: totalBreakdown
      },
      accountStats,
      isFiltered: !!(month || year)
    });

  } catch (error) {
    logger.error('Failed to fetch transfer stats', { error: error.message });
    res.status(500).json({
      code: 'STATS_FETCH_FAILED',
      message: 'Failed to fetch transfer statistics',
      error: error.message
    });
  }
};

// ✅ NEW: Bulk internal transfer between accounts
const bulkInternalTransfer = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { organizationId, id: userId } = req.user;
    const { transfers, notes } = req.body; 
    // transfers = [{ design, color, size, fromAccount, toAccount, quantity }]
    const AllocationChange = require('../models/AllocationChange');

    if (!Array.isArray(transfers) || transfers.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        code: 'INVALID_DATA',
        message: 'Transfers array is required'
      });
    }

    const results = [];
    const transferLogs = [];
    const allocationChanges = [];

    for (const item of transfers) {
      const { design, color, size, fromAccount, toAccount, quantity } = item;

      // Validation
      if (!fromAccount || !toAccount) {
        results.push({ 
          design, color, size, 
          success: false, 
          error: 'Source and destination accounts are required' 
        });
        continue;
      }

      if (fromAccount === toAccount) {
        results.push({ 
          design, color, size, 
          success: false, 
          error: 'Source and destination accounts must be different' 
        });
        continue;
      }

      if (!quantity || quantity <= 0) {
        results.push({ 
          design, color, size, 
          success: false, 
          error: 'Quantity must be greater than 0' 
        });
        continue;
      }

      // Find product
      const product = await Product.findOne({ design, organizationId }).session(session);
      if (!product) {
        results.push({ design, color, size, success: false, error: 'Product not found' });
        continue;
      }

      // Find variant
      const colorVariant = product.colors.find(c => c.color === color);
      const sizeVariant = colorVariant?.sizes.find(s => s.size === size);
      if (!sizeVariant) {
        results.push({ design, color, size, success: false, error: 'Variant not found' });
        continue;
      }

      // Find source allocation
      const sourceAllocation = sizeVariant.reservedAllocations?.find(
        a => a.accountName === fromAccount
      );

      if (!sourceAllocation) {
        results.push({ 
          design, color, size, 
          success: false, 
          error: `No allocation found for source account: ${fromAccount}` 
        });
        continue;
      }

      if (sourceAllocation.quantity < quantity) {
        results.push({ 
          design, color, size, 
          success: false, 
          error: `Insufficient stock in ${fromAccount}. Available: ${sourceAllocation.quantity}, Requested: ${quantity}` 
        });
        continue;
      }

      // Find or create destination allocation
      let destAllocation = sizeVariant.reservedAllocations?.find(
        a => a.accountName === toAccount
      );

      const sourceQtyBefore = sourceAllocation.quantity;
      const destQtyBefore = destAllocation?.quantity || 0;

      // Update source allocation
      sourceAllocation.quantity -= quantity;
      sourceAllocation.updatedAt = new Date();

      // Update or create destination allocation
      if (destAllocation) {
        destAllocation.quantity += quantity;
        destAllocation.updatedAt = new Date();
      } else {
        // Create new allocation
        if (!sizeVariant.reservedAllocations) {
          sizeVariant.reservedAllocations = [];
        }
        sizeVariant.reservedAllocations.push({
          accountName: toAccount,
          quantity: quantity,
          allocatedAt: new Date(),
          updatedAt: new Date()
        });
        destAllocation = sizeVariant.reservedAllocations[sizeVariant.reservedAllocations.length - 1];
      }

      const sourceQtyAfter = sourceAllocation.quantity;
      const destQtyAfter = destAllocation.quantity;

      // Remove source allocation if quantity becomes 0
      sizeVariant.reservedAllocations = sizeVariant.reservedAllocations.filter(
        alloc => alloc.quantity > 0
      );

      // Log allocation changes
      // Source account (removal)
      allocationChanges.push({
        productId: product._id,
        design: product.design,
        color: color,
        size: size,
        accountName: fromAccount,
        quantityBefore: sourceQtyBefore,
        quantityAfter: sourceQtyAfter,
        amountChanged: -quantity,
        changeType: 'internal_transfer_out',
        relatedOrderType: null,
        changedBy: userId,
        notes: notes || `Internal transfer to ${toAccount} (${quantity} units)`,
        organizationId: organizationId
      });

      // Destination account (addition)
      allocationChanges.push({
        productId: product._id,
        design: product.design,
        color: color,
        size: size,
        accountName: toAccount,
        quantityBefore: destQtyBefore,
        quantityAfter: destQtyAfter,
        amountChanged: +quantity,
        changeType: 'internal_transfer_in',
        relatedOrderType: null,
        changedBy: userId,
        notes: notes || `Internal transfer from ${fromAccount} (${quantity} units)`,
        organizationId: organizationId
      });

      await product.save({ session });

      logger.info('Internal transfer completed', {
        design, color, size,
        from: `${fromAccount}(${sourceQtyBefore}→${sourceQtyAfter})`,
        to: `${toAccount}(${destQtyBefore}→${destQtyAfter})`,
        quantity
      });

      // Prepare transfer log
      transferLogs.push({
        design,
        color,
        size,
        quantity,
        type: 'internal_transfer',
        from: `reserved-${fromAccount}`,
        to: `reserved-${toAccount}`,
        mainStockBefore: sizeVariant.currentStock,
        reservedStockBefore: sizeVariant.reservedStock,
        mainStockAfter: sizeVariant.currentStock, // Unchanged
        reservedStockAfter: sizeVariant.reservedStock, // Unchanged
        performedBy: userId,
        notes: notes || `Internal transfer: ${fromAccount} → ${toAccount} (${quantity} units)`,
        organizationId
      });

      results.push({
        design, color, size,
        fromAccount,
        toAccount,
        quantity,
        success: true,
        sourceAllocation: {
          before: sourceQtyBefore,
          after: sourceQtyAfter
        },
        destAllocation: {
          before: destQtyBefore,
          after: destQtyAfter
        }
      });
    }

    // Insert all allocation changes
    if (allocationChanges.length > 0) {
      await AllocationChange.insertMany(allocationChanges, { session });
      logger.info('Allocation changes logged for internal transfer', { count: allocationChanges.length });
    }

    // Insert all transfer logs
    if (transferLogs.length > 0) {
      await Transfer.insertMany(transferLogs, { session });
    }

    await session.commitTransaction();

    const successCount = results.filter(r => r.success).length;
    logger.info('Bulk internal transfer completed', {
      total: transfers.length,
      success: successCount,
      failed: transfers.length - successCount
    });

    res.json({
      success: true,
      message: `Bulk internal transfer completed. ${successCount}/${transfers.length} successful`,
      results
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Bulk internal transfer failed', { error: error.message });
    res.status(500).json({
      code: 'BULK_INTERNAL_TRANSFER_FAILED',
      message: 'Failed to complete bulk internal transfer',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

module.exports = {
  getAllTransfers,
  getRecentTransfers,
  transferToReserved,
  transferToMain,
  bulkTransferToReserved,
  bulkTransferToMain,
  getTransferStats,
  bulkInternalTransfer  
};
