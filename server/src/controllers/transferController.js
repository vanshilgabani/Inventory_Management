const Transfer = require('../models/Transfer');
const Product = require('../models/Product');
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
      type: 'manual_refill',
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
      type: 'manual_return',
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
        type: 'manual_refill',
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

// Bulk transfer to main (for returns)
const bulkTransferToMain = async (req, res) => {
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

      // Check reserved stock
      const reservedStock = sizeVariant.reservedStock || 0;
      if (reservedStock < quantity) {
        results.push({
          design, color, size, success: false,
          error: `Insufficient reserved stock. Available: ${reservedStock}`
        });
        continue;
      }

      // Store snapshots
      const mainBefore = sizeVariant.currentStock;
      const reservedBefore = sizeVariant.reservedStock;

      // Update stocks
      sizeVariant.currentStock += quantity;
      sizeVariant.reservedStock -= quantity;
      await product.save({ session });

      // Prepare transfer log
      transferLogs.push({
        design,
        color,
        size,
        quantity,
        type: 'manual_return',
        from: 'reserved',
        to: 'main',
        mainStockBefore: mainBefore,
        reservedStockBefore: reservedBefore,
        mainStockAfter: sizeVariant.currentStock,
        reservedStockAfter: sizeVariant.reservedStock,
        performedBy: userId,
        notes: notes || `Bulk return`,
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

module.exports = {
  getAllTransfers,
  getRecentTransfers,
  transferToReserved,
  transferToMain,
  bulkTransferToReserved,
  bulkTransferToMain
};
