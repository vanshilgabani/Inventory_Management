const MarketplaceSale = require('../models/MarketplaceSale');
const Product = require('../models/Product');
const Settings = require('../models/Settings');
const ActionLog = require('../models/ActionLog');
const Transfer = require('../models/Transfer');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const Subscription = require('../models/Subscription');
const TenantSettings = require('../models/TenantSettings');
const MarketplaceSKUMapping = require('../models/MarketplaceSKUMapping');
const AllocationChange = require('../models/AllocationChange');
const { parseMarketplaceSKU, matchColor, suggestDesign } = require('../utils/skuParser');
const { convertSizeToLetter } = require('../utils/sizeMappings');
const { runAutoAllocation } = require('./autoAllocationController');

// Escape special regex characters for safe use in MongoDB $regex queries
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const detectFlipkartCSVType = (headers) => {
  const normalized = headers.map(h => (h || '').trim().toLowerCase());

  // Return CSV signature: at least 2 of these unique columns must be present
  const returnSignature = [
    'return id',
    'return reason',
    'return sub-reason',
    'return status',
    'return type',
  ];
  const returnMatchCount = returnSignature.filter(col => normalized.includes(col)).length;
  if (returnMatchCount >= 2) return 'return';

  // Dispatch CSV: has 'order item id' and 'tracking id' but NOT 'return id'
  const hasOrderItemId = normalized.includes('order item id');
  const hasTrackingId  = normalized.includes('tracking id');
  const noReturnId     = !normalized.includes('return id');
  if (hasOrderItemId && hasTrackingId && noReturnId) return 'dispatch';

  return 'unknown';
};

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

// Helper to convert Invoice Date to ISO format
const convertInvoiceDateToISO = (invoiceDate) => {
  if (!invoiceDate) return new Date().toISOString().split('T')[0];
  
  // Handle format: "01-03-2026" or "01/03/26"
  const cleaned = invoiceDate.replace(/\s/g, '');
  
  // Try MM-DD-YYYY format
  if (cleaned.match(/^\d{2}-\d{2}-\d{4}$/)) {
    const [month, day, year] = cleaned.split('-');
    return `${year}-${month}-${day}`;
  }
  
  // Try MM/DD/YY format
  if (cleaned.match(/^\d{2}\/\d{2}\/\d{2}$/)) {
    const [month, day, year] = cleaned.split('/');
    const fullYear = `20${year}`;
    return `${fullYear}-${month}-${day}`;
  }
  
  // Fallback
  return new Date().toISOString().split('T')[0];
};

// ============================================
// COLOR MAPPING - Flipkart to Your Inventory
// ============================================
const FLIPKART_COLOR_MAP = {
  // Direct matches
  'BLACK': 'Black',
  'GREEN': 'Green',
  
  // Spelling corrections
  'KHAKHI': 'Khaki',
  'KHAKI': 'Khaki',
  
  // Light Grey variations
  'L.GREY': 'Light Grey',
  'L.GRAY': 'Light Grey',
  'LGREY': 'Light Grey',
  'LGRAY': 'Light Grey',
  'LIGHT GREY': 'Light Grey',
  'LIGHT GRAY': 'Light Grey',
  'LIGHTGREY': 'Light Grey',
  'LIGHTGRAY': 'Light Grey',
  'L GREY': 'Light Grey',     // ✅ ADD THIS
  'L GRAY': 'Light Grey',
  
  // Dark Grey variations
  'D.GREY': 'Dark Grey',
  'D.GRAY': 'Dark Grey',
  'DGREY': 'Dark Grey',
  'DGRAY': 'Dark Grey',
  'DARK GREY': 'Dark Grey',
  'DARK GRAY': 'Dark Grey',
  'DARKGREY': 'Dark Grey',
  'DARKGRAY': 'Dark Grey',
  'D GREY': 'Dark Grey',      // ✅ ADD THIS
  'D GRAY': 'Dark Grey',
  
  // Navy Blue variations
  'NAVY': 'Navy Blue',
  'NAVYBLUE': 'Navy Blue',
  'NAVY BLUE': 'Navy Blue',
  'N.BLUE': 'Navy Blue',
  
  // Additional colors
  'CHIKOO': 'Chikoo',
  'PISTA': 'Pista',
  'PISTACHIO': 'Pista'
};

// ============================================
// SKU PARSER - Handles Flipkart SKU formats
// ============================================
function parseFlipkartSKU(sku) {
  if (!sku) return { design: null, color: null, size: null };
  
  // Remove # and trim
  const cleaned = sku.replace('#', '').trim();
  const parts = cleaned.split('-');
  
  if (parts.length < 3) {
    return { design: null, color: null, size: null };
  }
  
  let design, color, size;
  
  // Pattern 1: #D-11-KHAKHI-XL (D and number separate)
  if (parts[0] === 'D' && !isNaN(parts[1])) {
    design = 'D' + parts[1]; // D11
    // Handle multi-part colors (e.g., NAVY-BLUE)
    color = parts.slice(2, -1).join('-'); // Everything between design and size
    size = parts[parts.length - 1]; // Last part
  }
  // Pattern 2: #D9-L.GREY-L (D and number together)
  else if (parts[0].startsWith('D') && !isNaN(parts[0].substring(1))) {
    design = parts[0]; // D9
    color = parts.slice(1, -1).join('-'); // Everything between design and size
    size = parts[parts.length - 1]; // Last part
  }
  // Pattern 3: #D13-KHAKHI-L (D and double-digit together)
  else if (parts[0].match(/^D\d+$/)) {
    design = parts[0]; // D13
    color = parts.slice(1, -1).join('-');
    size = parts[parts.length - 1];
  }
  else {
    return { design: null, color: null, size: null };
  }
  
  // Clean color (remove dots, spaces)
  if (color) {
    color = color.trim()
  }
  
  return { design, color, size };
}

// ============================================
// COLOR MATCHER - Auto-match with fuzzy logic
// ============================================
function matchColorToInventory(flipkartColor, inventoryColors) {
  if (!flipkartColor) return null;
  
  const upperFlipkart = flipkartColor.toUpperCase().trim();
  
  // Step 1: Check exact mapping first
  if (FLIPKART_COLOR_MAP[upperFlipkart]) {
    const mappedColor = FLIPKART_COLOR_MAP[upperFlipkart];
    // Verify mapped color exists in inventory (case-insensitive)
    const found = inventoryColors.find(c => 
      c.color.toUpperCase() === mappedColor.toUpperCase()
    );
    if (found) return found.color; // Return the actual inventory color
  }
  
  // Step 2: Case-insensitive exact match
  const exactMatch = inventoryColors.find(c => 
    c.color.toUpperCase() === upperFlipkart
  );
  if (exactMatch) return exactMatch.color;
  
  // Step 3: Fuzzy match (remove spaces, dots, dashes)
  const cleanedFlipkart = upperFlipkart.replace(/[\s.-]/g, '');
  const fuzzyMatch = inventoryColors.find(c => {
    const cleanedInventory = c.color.toUpperCase().replace(/[\s.-]/g, '');
    return cleanedInventory === cleanedFlipkart;
  });
  if (fuzzyMatch) return fuzzyMatch.color;
  
  // Step 4: Partial match (contains)
  const partialMatch = inventoryColors.find(c =>
    c.color.toUpperCase().includes(upperFlipkart) ||
    upperFlipkart.includes(c.color.toUpperCase())
  );
  if (partialMatch) return partialMatch.color;
  
  // Not found
  return null;
}

// Valid statuses (removed 'delivered')
const VALID_STATUSES = ['dispatched', 'returned', 'wrongreturn', 'cancelled', 'RTO'];

// ✅ Create marketplace sale with ACCOUNT-BASED ALLOCATION
exports.createSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let allocationAfterDeduct = undefined;
    const {
      accountName,
      marketplaceOrderId,
      orderItemId,
      trackingId,
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
    if (!accountName || !orderItemId || !design || !color || !size || !quantity) {
      await session.abortTransaction();
      return res.status(400).json({
        code: 'INVALID_DATA',
        message: 'Required fields missing'
      });
    }

    // ✅ Check subscription for tenant users
    if (req.user.isTenant || req.user.role === 'tenant') {
      const subscription = await Subscription.findOne({ userId: req.user.id });
      if (!subscription) {
        await session.abortTransaction();
        return res.status(403).json({
          code: 'NO_SUBSCRIPTION',
          message: 'No active subscription found. Please start a trial or subscribe.'
        });
      }

      if (!['trial', 'active', 'grace-period'].includes(subscription.status)) {
        await session.abortTransaction();
        return res.status(403).json({
          code: 'SUBSCRIPTION_EXPIRED',
          message: 'Your subscription has expired. Please renew to continue.',
          data: {
            status: subscription.status,
            expiredAt: subscription.yearlyEndDate || subscription.trialEndDate
          }
        });
      }

      // Check trial limits
      if (subscription.planType === 'trial') {
        if (subscription.trialOrdersUsed >= subscription.trialOrdersLimit) {
          await session.abortTransaction();
          return res.status(403).json({
            code: 'TRIAL_LIMIT_REACHED',
            message: 'Trial order limit reached. Please upgrade to continue.',
            data: {
              ordersUsed: subscription.trialOrdersUsed,
              ordersLimit: subscription.trialOrdersLimit
            }
          });
        }

        if (new Date() > subscription.trialEndDate) {
          await session.abortTransaction();
          return res.status(403).json({
            code: 'TRIAL_EXPIRED',
            message: 'Trial period expired. Please upgrade to continue.',
            data: { trialEndDate: subscription.trialEndDate }
          });
        }
      }
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

    // ✅ Get tenant's inventory mode preference
    const orgSettings = await Settings.findOne({ organizationId }).session(session);
    const inventoryMode = orgSettings?.inventoryMode || 'reserved';

    logger.info('📦 Inventory mode for sale:', {
      organizationId,
      inventoryMode,
      design,
      color,
      size,
      quantity
    });

    // Store snapshots for logging
    const mainBefore = sizeVariant.currentStock || 0;
    const reservedBefore = sizeVariant.reservedStock || 0;

    if (inventoryMode === 'main') {
      // ✅ MAIN INVENTORY MODE: Deduct from currentStock
      const mainStock = sizeVariant.currentStock || 0;

      if (mainStock < quantity) {
        await session.abortTransaction();
        return res.status(400).json({
          code: 'INSUFFICIENT_MAIN_STOCK',
          message: `Insufficient main stock for ${design} - ${color} - ${size}`,
          variant: { design, color, size },
          available: mainStock,
          required: quantity
        });
      }

      // Deduct from main stock
      colorVariant.sizes[sizeIndex].currentStock -= quantity;

      logger.info('✅ Deducted from MAIN inventory', {
        design, color, size, quantity,
        mainBefore,
        mainAfter: colorVariant.sizes[sizeIndex].currentStock
      });

      } else {
    // ✅ RESERVED INVENTORY MODE with ACCOUNT-BASED ALLOCATION
    const reservedStock = sizeVariant.reservedStock || 0;
    const mainStock = sizeVariant.currentStock || 0;

    // Check reserved stock first
    if (reservedStock < quantity) {
      const deficit = quantity - reservedStock;

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

      // Need to use main stock - send popup trigger
      await session.abortTransaction();
      return res.status(400).json({
        code: 'RESERVED_INSUFFICIENT_USE_MAIN',
        message: `Reserved stock insufficient. Need ${deficit} units from main inventory.`,
        variant: { design, color, size },
        reservedStock,
        mainStock,
        required: quantity,
        deficit,
        canUseMain: true
      });
    }

    // ✅✅ NEW: Check account allocation BEFORE deducting
    const allocation = sizeVariant.reservedAllocations?.find(
      a => a.accountName === accountName
    );

    if (!allocation || allocation.quantity < quantity) {
      const available = allocation?.quantity || 0;
      const totalAllocated = sizeVariant.reservedAllocations?.reduce((sum, a) => sum + a.quantity, 0) || 0;
      const pool = reservedStock - totalAllocated;

      await session.abortTransaction();
      return res.status(400).json({
        code: 'INSUFFICIENT_ACCOUNT_STOCK',
        message: `Insufficient stock for ${accountName}. Available: ${available}, Need: ${quantity}`,
        variant: { design, color, size },
        accountName,
        available,
        required: quantity,
        deficit: quantity - available,
        pool,
        totalReserved: reservedStock,
        suggestion: pool >= (quantity - available) 
          ? `Pool has ${pool} units. Allocate ${quantity - available} more to ${accountName}?`
          : `Not enough stock. Pool: ${pool}, Need: ${quantity - available} more`
      });
    }

    // ✅✅ Deduct from account allocation AND total reserved
    allocation.quantity -= quantity;
    colorVariant.sizes[sizeIndex].reservedStock -= quantity;

    const allocationAfterDeduct = allocation.quantity; // NEW — capture before save

    logger.info('✅ Deducted from account allocation', {
      design,
      color,
      size,
      quantity,
      accountName,
      allocationBefore: allocation.quantity + quantity,
      allocationAfter: allocation.quantity,
      reservedBefore,
      reservedAfter: colorVariant.sizes[sizeIndex].reservedStock
    });
  }

    await product.save({ session });

    // Create sale
    const sale = await MarketplaceSale.create([{
      accountName,
      marketplaceOrderId: marketplaceOrderId || `MP-${Date.now()}`,
      orderItemId,
      trackingId: trackingId || null,   
      design,
      color,
      size,
      quantity,
      saleDate: saleDate || new Date(),
      status: status || 'dispatched',
      notes,
      organizationId,
      tenantId: organizationId,
      inventoryModeUsed: inventoryMode,
      createdByUser: {
        userId: req.user._id,
        userName: req.user.name || req.user.email,
        userRole: req.user.role,
        createdAt: new Date()
      }
    }], { session });

    // Log transfer
    await Transfer.create([{
      design,
      color,
      size,
      quantity,
      type: 'marketplaceorder',
      from: inventoryMode === 'main' ? 'main' : 'reserved',
      to: 'sold',
      mainStockBefore: mainBefore,
      reservedStockBefore: reservedBefore,
      mainStockAfter: inventoryMode === 'main' ? (mainBefore - quantity) : mainBefore,
      reservedStockAfter: inventoryMode === 'reserved' ? (reservedBefore - quantity) : reservedBefore,
      relatedOrderId: sale[0]._id,
      relatedOrderType: 'marketplace',
      performedBy: userId,
      notes: `Marketplace order ${marketplaceOrderId || 'created'} (${inventoryMode} inventory, account: ${accountName})`,
      organizationId
    }], { session });

    // Track subscription order count (BEFORE commit)
    if (req.user.isTenant || req.user.role === 'tenant') {
      const subscription = await Subscription.findOne({ userId: req.user.id }).session(session);
      if (subscription && subscription.planType === 'trial') {
        subscription.trialOrdersUsed += 1;
        await subscription.save({ session });
        logger.info('Trial order count incremented', {
          userId: req.user.id,
          ordersUsed: subscription.trialOrdersUsed,
          ordersLimit: subscription.trialOrdersLimit
        });
      }
    }

    await session.commitTransaction();
    // If this account's allocation just hit 0, trigger auto reallocation
    if (allocationAfterDeduct === 0) {
      runAutoAllocation(
        organizationId,
        design,
        color,
        size,
        'account_empty',
        accountName,
        userId
      ).catch(err => logger.error('Auto allocation failed after sale:', err.message));
    }

    logger.info('Marketplace sale created', {
      saleId: sale[0]._id,
      design, color, size, quantity, accountName
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
    const { accountName, marketplaceOrderId, orderItemId, trackingId, design, color, size, quantity, saleDate, status, notes, useMainStock } = req.body;
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
    
    // ✅✅ NEW: Check account allocation first
    const allocation = sizeVariant.reservedAllocations?.find(a => a.accountName === accountName);
    const accountStock = allocation?.quantity || 0;
    
    const mainStock = sizeVariant.currentStock || 0;
    const deficit = quantity - accountStock;

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

    let mainSaleAccountHitZero = false;
    // ✅✅ Use account stock first, then main
    if (accountStock > 0) {
      // Use all available account stock
      allocation.quantity = 0;
      mainSaleAccountHitZero = true;
      colorVariant.sizes[sizeIndex].reservedStock -= accountStock;
    }

    // Use main stock for the deficit
    colorVariant.sizes[sizeIndex].currentStock -= deficit;

    product.markModified('colors'); 
    await product.save({ session });

    // Create sale
    const sale = await MarketplaceSale.create([{
      accountName,
      marketplaceOrderId: marketplaceOrderId || `MP-${Date.now()}`,
      orderItemId: orderItemId,
      trackingId: trackingId || null,   
      design,
      color,
      size,
      quantity,
      saleDate: saleDate || new Date(),
      status: status || 'dispatched',
      notes: notes ? `${notes} [Used main stock]` : '[Used main stock]',
      organizationId,
      tenantId: organizationId,
      inventoryModeUsed: 'reserved', // ✅ Still marked as reserved mode (emergency main use)
      createdByUser: {
        userId: req.user._id,
        userName: req.user.name || req.user.email,
        userRole: req.user.role,
        createdAt: new Date()
      }
    }], { session });

    // Log transfers
    if (accountStock > 0) {
      // Log account reserved stock usage
      await Transfer.create([{
        design, color, size,
        quantity: accountStock,
        type: 'marketplaceorder',
        from: 'reserved',
        to: 'sold',
        mainStockBefore: mainBefore,
        reservedStockBefore: reservedBefore,
        mainStockAfter: mainBefore,
        reservedStockAfter: reservedBefore - accountStock,
        relatedOrderId: sale[0]._id,
        relatedOrderType: 'marketplace',
        performedBy: userId,
        notes: `Marketplace order - ${accountName} account portion`,
        organizationId
      }], { session });
    }

    // Log emergency main stock usage
    await Transfer.create([{
      design, color, size,
      quantity: deficit,
      type: 'emergencyuse',
      from: 'main',
      to: 'sold',
      mainStockBefore: mainBefore,
      reservedStockBefore: reservedBefore,
      mainStockAfter: sizeVariant.currentStock,
      reservedStockAfter: sizeVariant.reservedStock,
      relatedOrderId: sale[0]._id,
      relatedOrderType: 'marketplace',
      performedBy: userId,
      notes: `Emergency use of main stock for ${accountName} account`,
      organizationId
    }], { session });

    await session.commitTransaction();
    session.endSession();
    // Account allocation hit 0 (all used + went to main), trigger reallocation
    if (mainSaleAccountHitZero) {
      runAutoAllocation(
        organizationId,
        design,
        color,
        size,
        'account_empty',
        accountName,
        userId
      ).catch(err => logger.error('Auto allocation failed after main stock sale:', err.message));
    }

    logger.info('Marketplace sale created with main stock', {
      saleId: sale[0]._id,
      accountName,
      usedFromAccount: accountStock,
      usedFromMain: deficit
    });

    res.status(201).json({
      success: true,
      data: {
        ...sale[0].toObject(),
        usedMainStock: true,
        breakdown: {
          fromAccountReserved: accountStock,
          fromMain: deficit,
        },
      },
    });

  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    logger.error('Sale with main stock failed', { error: error.message });
    res.status(500).json({
      code: 'SALE_CREATION_FAILED',
      message: 'Failed to create sale',
      error: error.message
    });
    } finally {
    // ✅ Safe end — won't throw even if already ended
    try { session.endSession(); } catch (_) {}
  }
};

// ✅ NEW: Get accurate stats for cards (separate from loaded orders)
exports.getStatsForCards = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { accountName, startDate, endDate, status } = req.query;

    const filter = { organizationId, deletedAt: null };

    // Account filter
    if (accountName && accountName !== 'all') {
      filter.accountName = accountName;
    }

    // Date range filter
    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.saleDate.$lte = end;
      }
    }

    // Status filter (for tab filtering)
    if (status && status !== 'all') {
      const statuses = status.split(',').map(s => s.trim());
      filter.status = { $in: statuses };
    }

    // Get counts grouped by status
    const stats = await MarketplaceSale.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get total count
    const total = await MarketplaceSale.countDocuments(filter);

    // Format response
    const statusCounts = {
      dispatched: 0,
      delivered: 0,
      returned: 0,
      cancelled: 0,
      wrongreturn: 0,
      RTO: 0
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
      message: 'Failed to fetch stats',
      error: error.message
    });
  }
};

// Helper: Calculate display date based on status
// In salesController.js - REPLACE getDisplayDate function

const getDisplayDate = (sale) => {
  const returnStatuses = ['returned', 'cancelled', 'wrongreturn', 'RTO'];

  // If current status is returned/cancelled/wrongreturn/RTO
  if (returnStatuses.includes(sale.status)) {
    const statusHistory = sale.statusHistory;

    // Check if statusHistory exists and has entries
    if (statusHistory && Array.isArray(statusHistory) && statusHistory.length > 0) {
      // Search backwards (most recent first)
      for (let i = statusHistory.length - 1; i >= 0; i--) {
        const entry = statusHistory[i];
        
        // Make sure entry and newStatus exist
        if (entry && entry.newStatus && returnStatuses.includes(entry.newStatus)) {
          // Make sure changedAt exists
          if (entry.changedAt) {
            console.log(`✅ Found return date for ${sale.orderItemId}: ${entry.changedAt}`);
            return new Date(entry.changedAt).toISOString().split('T')[0];
          }
        }
      }
    }
    
    // If we couldn't find a return date in statusHistory, log a warning
    console.warn(`⚠️ No return date found in statusHistory for ${sale.orderItemId}, using saleDate`);
  }

  // Default: use dispatch date (saleDate)
  return new Date(sale.saleDate).toISOString().split('T')[0];
};

// In salesController.js - REPLACE the entire getOrdersByDateGroups function

exports.getOrdersByDateGroups = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { accountName, status, startDate, endDate, dateGroups = 5, beforeDate } = req.query;

    const filter = { organizationId, deletedAt: null };

    // Account filter
    if (accountName && accountName !== 'all') {
      filter.accountName = accountName;
    }

    // Status filter for tabs
    if (status && status !== 'all') {
      const statuses = status.split(',').map(s => s.trim());
      filter.status = { $in: statuses };
    }

    // ❌ REMOVE THIS - DON'T filter by saleDate here!
    // Date range filter will be applied AFTER calculating displayDate
    
    // ✅ Fetch ALL orders without date filtering
    const orders = await MarketplaceSale.find(filter)
      .sort({ saleDate: -1, createdAt: -1 })
      .limit(500)
      .lean()
      .select('-__v -editHistory')
      .maxTimeMS(10000);

    if (orders.length === 0) {
      return res.json({
        success: true,
        data: {
          dateGroups: [],
          pagination: {
            hasMore: false,
            nextBeforeDate: null,
            totalDatesLoaded: 0,
            totalOrdersInResponse: 0
          }
        }
      });
    }

    // ✅ Group orders by display date (return date for returned orders)
    const dateGroupsMap = new Map();
    
    orders.forEach(order => {
      const displayDate = getDisplayDate(order); // Get the correct display date
      order.displayDate = displayDate; // Attach to order object

      // ✅ Apply date filters AFTER calculating displayDate
      const displayDateObj = new Date(displayDate);
      
      if (startDate) {
        const startDateObj = new Date(startDate);
        if (displayDateObj < startDateObj) return; // Skip this order
      }
      
      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        if (displayDateObj > endDateObj) return; // Skip this order
      }

      if (beforeDate) {
        const beforeDateObj = new Date(beforeDate);
        beforeDateObj.setHours(0, 0, 0, 0);
        if (displayDateObj >= beforeDateObj) return; // Skip this order
      }

      // Group by displayDate
      if (!dateGroupsMap.has(displayDate)) {
        dateGroupsMap.set(displayDate, {
          date: displayDate,
          orders: [],
          accountBreakdown: {}
        });
      }

      const group = dateGroupsMap.get(displayDate);
      group.orders.push(order);

      // Count by account
      if (!group.accountBreakdown[order.accountName]) {
        group.accountBreakdown[order.accountName] = 0;
      }
      group.accountBreakdown[order.accountName]++;
    });

    // Convert to array and sort by date (newest first)
    let dateGroupsArray = Array.from(dateGroupsMap.values())
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map(group => ({
        date: group.date,
        dateLabel: formatDateLabel(group.date),
        orderCount: group.orders.length,
        accountBreakdown: group.accountBreakdown,
        orders: group.orders.map(order => ({
          ...order,
          displayDate: order.displayDate || order.date // ✅ Ensure displayDate is in each order
        }))
      }));

    // Limit to requested number of date groups
    const limitedDateGroups = dateGroupsArray.slice(0, parseInt(dateGroups));
    const hasMore = dateGroupsArray.length > parseInt(dateGroups);
    const oldestLoadedDate = limitedDateGroups[limitedDateGroups.length - 1]?.date;
    
    console.log('📤 SENDING DATE GROUPS:');
    limitedDateGroups.slice(0, 3).forEach((group, idx) => {
      console.log(`\n  Group ${idx + 1}: ${group.date} (${group.dateLabel})`);
      console.log(`    - Total orders: ${group.orderCount}`);
      console.log(`    - First order saleDate: ${group.orders[0]?.saleDate}`);
      console.log(`    - First order displayDate: ${group.orders[0]?.displayDate}`);
      console.log(`    - First order status: ${group.orders[0]?.status}`);
    });

    res.json({
      success: true,
      data: {
        dateGroups: limitedDateGroups,
        pagination: {
          hasMore: hasMore,
          nextBeforeDate: oldestLoadedDate,
          totalDatesLoaded: limitedDateGroups.length,
          totalOrdersInResponse: limitedDateGroups.reduce((sum, g) => sum + g.orders.length, 0)
        }
      }
    });
  } catch (error) {
    console.error('Get orders by date groups error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch orders', error: error.message });
  }
};

// Helper function to format date labels
function formatDateLabel(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const orderDate = new Date(dateString);
  orderDate.setHours(0, 0, 0, 0);

  if (orderDate.getTime() === today.getTime()) {
    return 'TODAY';
  } else if (orderDate.getTime() === yesterday.getTime()) {
    return 'YESTERDAY';
  } else {
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  }
}

// GET SALES WITH CURSOR-BASED PAGINATION (Optimized for Infinite Scroll)
exports.getAllSales = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { 
      status, 
      accountName, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 50, // ✅ Changed from unlimited
      search,
      cursor // ✅ NEW: for infinite scroll
    } = req.query;

    const filter = { organizationId, deletedAt: null };

    // Status filter
    if (status && status !== 'all') {
      const statuses = status.split(',').map(s => s.trim());
      filter.status = { $in: statuses };
    }

    // Account filter
    if (accountName && accountName !== 'all') {
      filter.accountName = accountName;
    }

    // Date range filter
    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.saleDate.$lte = end;
      }
    }

    // ✅ SEARCH FILTER
    if (search && search.trim()) {
      const searchTerm = search.trim();
      filter.$or = [
        { design: { $regex: searchTerm, $options: 'i' } },
        { orderItemId: { $regex: searchTerm, $options: 'i' } },
        { marketplaceOrderId: { $regex: searchTerm, $options: 'i' } },
        { color: { $regex: searchTerm, $options: 'i' } },
        { size: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    // ✅ CURSOR-BASED PAGINATION
    if (cursor) {
      filter._id = { $lt: cursor };
    }

    const limitNum = parseInt(limit);

    // Fetch one extra to check if more exist
    const sales = await MarketplaceSale.find(filter)
      .sort({ saleDate: -1, _id: -1 })
      .limit(limitNum + 1)
      .lean()
      .select('-__v -editHistory')
      .maxTimeMS(5000);

    const hasMore = sales.length > limitNum;
    const items = hasMore ? sales.slice(0, limitNum) : sales;
    const nextCursor = hasMore ? items[items.length - 1]._id : null;

    res.json({
      success: true,
      data: items,
      pagination: {
        hasMore,
        nextCursor,
        count: items.length
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

// ✅ NEW: GLOBAL SEARCH API (Search across all pages)
exports.searchSales = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { query, accountName, status, field } = req.query;

    if (!query || query.trim().length < 2) {
      return res.json({
        success: true,
        data: [],
        message: 'Search query too short'
      });
    }

    const filter = { organizationId, deletedAt: null };

    // Apply account and status filters
    if (accountName && accountName !== 'all') {
      filter.accountName = accountName;
    }

    if (status && status !== 'all') {
      const statuses = status.split(',').map(s => s.trim());
      filter.status = { $in: statuses };
    }

    // Search across multiple fields
    const searchTerm = query.trim();
    if (field === 'trackingId') {
      filter.$or = [
        { trackingId:       { $regex: searchTerm, $options: 'i' } },  // forward tracking
        { returnTrackingId: { $regex: searchTerm, $options: 'i' } },  // return tracking (NEW)
      ];
    } else {
      filter.$or = [
        { design: { $regex: searchTerm, $options: 'i' } },
        { orderItemId: { $regex: searchTerm, $options: 'i' } },
        { marketplaceOrderId: { $regex: searchTerm, $options: 'i' } },
        { color: { $regex: searchTerm, $options: 'i' } },
        { size: { $regex: searchTerm, $options: 'i' } },
        { trackingId:         { $regex: searchTerm, $options: 'i' } }, 
        { returnTrackingId:   { $regex: searchTerm, $options: 'i' } },
      ];
    }

    // Limit search results to 200 for performance
    const results = await MarketplaceSale.find(filter)
      .sort({ saleDate: -1 })
      .limit(200)
      .lean()
      .maxTimeMS(3000);

    res.json({
      success: true,
      data: results,
      count: results.length,
      limited: results.length === 200
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
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

    const filter = { organizationId, deletedAt: null };

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
      cancelled: 0,
      RTO: 0
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
// ✅ Update sale with ACCOUNT-BASED STOCK RESTORATION
exports.updateSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;
    const userRole = req.user.role;

    const sale = await MarketplaceSale.findOne({ _id: id, organizationId }).session(session);

    if (!sale) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }

    if (!sale.tenantId) sale.tenantId = organizationId;

    const oldStatus = sale.status;
    const oldQuantity = sale.quantity;
    const oldDesign = sale.design;
    const oldColor = sale.color;
    const oldSize = sale.size;
    let stockRestored = 0;
    let stockDeducted = 0;

    // ─────────────────────────────────────────────
    // SHARED STOCK LOGIC (used by both admin + salesperson)
    // ─────────────────────────────────────────────
    const applyStockChange = async (newStatus) => {
      const product = await Product.findOne({ organizationId, design: sale.design, 'colors.color': sale.color }).session(session);
      if (!product) { console.warn(`Product ${sale.design} not found for stock change`); return; }

      const colorVariant = product.colors.find(c => c.color === sale.color);
      if (!colorVariant) { console.warn(`Color ${sale.color} not found in product ${sale.design}`); return; }

      const sizeVariant = colorVariant.sizes.find(s => s.size === sale.size);
      if (!sizeVariant) { console.warn(`Size ${sale.size} not found in ${sale.design}-${sale.color}`); return; }

      if (typeof sizeVariant.currentStock === 'undefined' || sizeVariant.currentStock === null || isNaN(sizeVariant.currentStock)) {
        console.warn(`currentStock was undefined for ${sale.design}-${sale.color}-${sale.size}, initializing to 0`);
        sizeVariant.currentStock = 0;
      }

      const stockRestoringStatuses = ['returned', 'cancelled', 'RTO'];
      const stockDeductingStatuses = ['dispatched'];
      const noStockChangeStatuses = ['wrongreturn', 'delivered'];

      const oldStatusType = stockRestoringStatuses.includes(oldStatus) ? 'restoring'
        : stockDeductingStatuses.includes(oldStatus) ? 'deducting'
        : noStockChangeStatuses.includes(oldStatus) ? 'none' : 'unknown';

      const newStatusType = stockRestoringStatuses.includes(newStatus) ? 'restoring'
        : stockDeductingStatuses.includes(newStatus) ? 'deducting'
        : noStockChangeStatuses.includes(newStatus) ? 'none' : 'unknown';

      console.log(`Status transition: ${oldStatus}(${oldStatusType}) → ${newStatus}(${newStatusType})`);
      console.log(`stockRestoredAmount on sale: ${sale.stockRestoredAmount || 0}`);

      const inventoryMode = sale.inventoryModeUsed || 'reserved';

      // ─── SCENARIO 1: dispatched/delivered → returned/cancelled/RTO ───────────────
      // Restore stock — but for "returned", restore the product actually received back
      if (newStatusType === 'restoring') {
        if ((sale.stockRestoredAmount || 0) <= 0) {

          // Check if user specified a different product received back
          const rp = req.body.returnedProduct; // { design, color, size, quantity }
          const hasDifferentProduct = ['returned', 'RTO'].includes(newStatus) && rp?.design && rp?.color && rp?.size;

          if (hasDifferentProduct) {
            // ── Restore stock for the DIFFERENT product received back ──
            const restoreQty = parseInt(rp.quantity) || 1;

            const retProduct = await Product.findOne({ design: rp.design, organizationId }).session(session);
            if (!retProduct) {
              await session.abortTransaction();
              throw new Error(`Returned product ${rp.design} not found in inventory`);
            }

            const retColorVariant = retProduct.colors.find(c => c.color === rp.color);
            if (!retColorVariant) {
              await session.abortTransaction();
              throw new Error(`Color ${rp.color} not found in ${rp.design}`);
            }

            const retSizeVariant = retColorVariant.sizes.find(s => s.size === rp.size);
            if (!retSizeVariant) {
              await session.abortTransaction();
              throw new Error(`Size ${rp.size} not found in ${rp.design}-${rp.color}`);
            }

            if (inventoryMode === 'main') {
              retSizeVariant.currentStock = (retSizeVariant.currentStock || 0) + restoreQty;
            } else {
              retSizeVariant.reservedStock = (retSizeVariant.reservedStock || 0) + restoreQty;
              // Restore to the same account's allocation
              let retAlloc = retSizeVariant.reservedAllocations?.find(a => a.accountName === sale.accountName);
              if (!retAlloc) {
                if (!retSizeVariant.reservedAllocations) retSizeVariant.reservedAllocations = [];
                retAlloc = { accountName: sale.accountName, quantity: 0 };
                retSizeVariant.reservedAllocations.push(retAlloc);
              }
              retAlloc.quantity += restoreQty;
              console.log(`Restored ${restoreQty} units of ${rp.design}-${rp.color}-${rp.size} to account ${sale.accountName}`);
            }

            retProduct.markModified('colors');
            await retProduct.save({ session });

            // Save returnedProduct info to the sale document
            sale.returnedProduct = { design: rp.design, color: rp.color, size: rp.size, quantity: restoreQty };
            sale.stockRestoredAmount = restoreQty;
            stockRestored = restoreQty;

          } else {
            // ── Restore stock for ORIGINAL product (normal return / cancelled / RTO) ──
            console.log(`SCENARIO 1: Restoring ${sale.quantity} to ${inventoryMode.toUpperCase()}`);
            if (inventoryMode === 'main') {
              sizeVariant.currentStock = (sizeVariant.currentStock || 0) + sale.quantity;
            } else {
              sizeVariant.reservedStock = (sizeVariant.reservedStock || 0) + sale.quantity;
              let allocation = sizeVariant.reservedAllocations?.find(a => a.accountName === sale.accountName);
              if (!allocation) {
                if (!sizeVariant.reservedAllocations) sizeVariant.reservedAllocations = [];
                allocation = { accountName: sale.accountName, quantity: 0 };
                sizeVariant.reservedAllocations.push(allocation);
              }
              allocation.quantity += sale.quantity;
              console.log(`Restored ${sale.quantity} units to account ${sale.accountName}`);
            }
            sale.stockRestoredAmount = sale.quantity;
            stockRestored = sale.quantity;
            product.markModified('colors');
            await product.save({ session });
          }

        } else {
          console.log(`SCENARIO 1 skipped - stock already restored: ${sale.stockRestoredAmount}`);
        }
      }

      // ─── SCENARIO 2: returned/cancelled/RTO → dispatched or wrongreturn ───────────
      // Un-restore stock (undo the restoration)
      else if (oldStatusType === 'restoring' && (newStatusType === 'deducting' || newStatusType === 'none')) {
        if ((sale.stockRestoredAmount || 0) > 0) {
          const amountToDeduct = sale.stockRestoredAmount;

          if (sale.returnedProduct?.design) {
            // Stock was restored for a DIFFERENT product — un-restore from that product
            const retProduct = await Product.findOne({ design: sale.returnedProduct.design, organizationId }).session(session);
            if (retProduct) {
              const retCV = retProduct.colors.find(c => c.color === sale.returnedProduct.color);
              if (retCV) {
                const retSV = retCV.sizes.find(s => s.size === sale.returnedProduct.size);
                if (retSV) {
                  if (inventoryMode === 'main') {
                    retSV.currentStock = Math.max(0, (retSV.currentStock || 0) - amountToDeduct);
                  } else {
                    retSV.reservedStock = Math.max(0, (retSV.reservedStock || 0) - amountToDeduct);
                    const retAlloc = retSV.reservedAllocations?.find(a => a.accountName === sale.accountName);
                    if (retAlloc) retAlloc.quantity = Math.max(0, retAlloc.quantity - amountToDeduct);
                  }
                  retProduct.markModified('colors');
                  await retProduct.save({ session });
                  console.log(`SCENARIO 2: Un-restored ${amountToDeduct} from ${sale.returnedProduct.design}-${sale.returnedProduct.color}-${sale.returnedProduct.size}`);
                }
              }
            }
            sale.returnedProduct = undefined; // clear it since we're undoing the return

          } else {
            // Un-restore from ORIGINAL product
            const availableStock = inventoryMode === 'main' ? (sizeVariant.currentStock || 0) : (sizeVariant.reservedStock || 0);
            if (availableStock < amountToDeduct) {
              await session.abortTransaction();
              throw new Error(`Insufficient ${inventoryMode} stock to undo restoration. Available: ${availableStock}, Required: ${amountToDeduct}`);
            }
            console.log(`SCENARIO 2: Undoing restoration from ${inventoryMode.toUpperCase()} -${amountToDeduct}`);
            if (inventoryMode === 'main') {
              sizeVariant.currentStock -= amountToDeduct;
            } else {
              sizeVariant.reservedStock -= amountToDeduct;
              const allocation = sizeVariant.reservedAllocations?.find(a => a.accountName === sale.accountName);
              if (allocation) allocation.quantity -= amountToDeduct;
              console.log(`Deducted ${amountToDeduct} from account ${sale.accountName}`);
            }
            product.markModified('colors');
            await product.save({ session });
          }

          sale.stockRestoredAmount = 0;
          stockDeducted = amountToDeduct;

        } else {
          console.log(`SCENARIO 2 skipped - stockRestoredAmount is 0`);
        }
      }

      // ─── SCENARIO 3: returned/cancelled/RTO → wrongreturn ────────────────────────
      else if (newStatusType === 'none' && oldStatusType === 'restoring') {
        if ((sale.stockRestoredAmount || 0) > 0) {
          const amountToDeduct = sale.stockRestoredAmount;

          if (sale.returnedProduct?.design) {
            const retProduct = await Product.findOne({ design: sale.returnedProduct.design, organizationId }).session(session);
            if (retProduct) {
              const retCV = retProduct.colors.find(c => c.color === sale.returnedProduct.color);
              if (retCV) {
                const retSV = retCV.sizes.find(s => s.size === sale.returnedProduct.size);
                if (retSV) {
                  if (inventoryMode === 'main') {
                    retSV.currentStock = Math.max(0, (retSV.currentStock || 0) - amountToDeduct);
                  } else {
                    retSV.reservedStock = Math.max(0, (retSV.reservedStock || 0) - amountToDeduct);
                    const retAlloc = retSV.reservedAllocations?.find(a => a.accountName === sale.accountName);
                    if (retAlloc) retAlloc.quantity = Math.max(0, retAlloc.quantity - amountToDeduct);
                  }
                  retProduct.markModified('colors');
                  await retProduct.save({ session });
                }
              }
            }
            sale.returnedProduct = undefined;
          } else {
            const availableStock = inventoryMode === 'main' ? (sizeVariant.currentStock || 0) : (sizeVariant.reservedStock || 0);
            if (availableStock < amountToDeduct) {
              await session.abortTransaction();
              throw new Error(`Insufficient ${inventoryMode} stock. Available: ${availableStock}, Required: ${amountToDeduct}`);
            }
            console.log(`SCENARIO 3: wrongreturn - Undoing restoration -${amountToDeduct}`);
            if (inventoryMode === 'main') {
              sizeVariant.currentStock -= amountToDeduct;
            } else {
              sizeVariant.reservedStock -= amountToDeduct;
              const allocation = sizeVariant.reservedAllocations?.find(a => a.accountName === sale.accountName);
              if (allocation) allocation.quantity -= amountToDeduct;
              console.log(`Deducted ${amountToDeduct} from account ${sale.accountName}`);
            }
            product.markModified('colors');
            await product.save({ session });
          }

          sale.stockRestoredAmount = 0;
          stockDeducted = amountToDeduct;
        }
      }

      // ─── SCENARIO 4: All other transitions — no stock change ─────────────────────
      else {
        console.log(`SCENARIO 4: No stock change needed for ${oldStatusType} → ${newStatusType}`);
      }
    };

    // ─────────────────────────────────────────────
    // ADMIN BRANCH
    // ─────────────────────────────────────────────
    if (userRole === 'admin') {
      const {
        accountName, saleDate, marketplaceOrderId, orderItemId, trackingId,
        design, color, size, quantity, status, notes, comments, changedAt
      } = req.body;

      // If product variant changed — restore old stock + deduct new stock
      if (design && color && size && (design !== oldDesign || color !== oldColor || size !== oldSize || quantity !== oldQuantity)) {
        const oldProduct = await Product.findOne({
          organizationId, design: oldDesign, 'colors.color': oldColor
        }).session(session);

        if (oldProduct) {
          const oldColorVariant = oldProduct.colors.find(c => c.color === oldColor);
          if (oldColorVariant) {
            const oldSizeVariant = oldColorVariant.sizes.find(s => s.size === oldSize);
            if (oldSizeVariant) {
              const inventoryMode = sale.inventoryModeUsed || 'reserved';
              if (inventoryMode === 'reserved') {
                let allocation = oldSizeVariant.reservedAllocations?.find(a => a.accountName === sale.accountName);
                if (!allocation) {
                  if (!oldSizeVariant.reservedAllocations) oldSizeVariant.reservedAllocations = [];
                  allocation = { accountName: sale.accountName, quantity: 0 };
                  oldSizeVariant.reservedAllocations.push(allocation);
                }
                allocation.quantity += oldQuantity;
                oldSizeVariant.reservedStock = (oldSizeVariant.reservedStock || 0) + oldQuantity;
              } else {
                oldSizeVariant.currentStock = (oldSizeVariant.currentStock || 0) + oldQuantity;
              }
              oldProduct.markModified('colors'); // ✅ CRITICAL
              await oldProduct.save({ session });
              stockRestored = oldQuantity;
            }
          }
        }

        // Deduct new variant stock
        const newProduct = await Product.findOne({
          organizationId, design, 'colors.color': color
        }).session(session);

        if (!newProduct) {
          await session.abortTransaction();
          return res.status(404).json({ success: false, message: `Product ${design} with color ${color} not found` });
        }

        const newColorVariant = newProduct.colors.find(c => c.color === color);
        if (!newColorVariant) {
          await session.abortTransaction();
          return res.status(404).json({ success: false, message: `Color ${color} not found` });
        }

        const newSizeVariant = newColorVariant.sizes.find(s => s.size === size);
        if (!newSizeVariant) {
          await session.abortTransaction();
          return res.status(404).json({ success: false, message: `Size ${size} not found` });
        }

        const currentStock = newSizeVariant.currentStock || 0;
        if (currentStock < quantity) {
          await session.abortTransaction();
          return res.status(400).json({ success: false, message: `Insufficient stock. Available: ${currentStock}` });
        }

        newSizeVariant.currentStock = currentStock - quantity;
        newProduct.markModified('colors'); // ✅ CRITICAL
        await newProduct.save({ session });
        stockDeducted = quantity;

        sale.design   = design;
        sale.color    = color;
        sale.size     = size;
        sale.quantity = quantity;
      }

      // Update other fields
      if (accountName)                  sale.accountName         = accountName;
      if (saleDate)                     sale.saleDate            = new Date(saleDate);
      if (marketplaceOrderId !== undefined) sale.marketplaceOrderId  = marketplaceOrderId;
      if (orderItemId        !== undefined) sale.orderItemId         = orderItemId;
      if (trackingId !== undefined) sale.trackingId = trackingId;   
      if (notes              !== undefined) sale.notes               = notes;

      // Status change
      if (status && status !== oldStatus) {
        if (!VALID_STATUSES.includes(status)) {
          await session.abortTransaction();
          return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
        }

        await applyStockChange(status); // ✅ shared logic

        sale.statusHistory.push({
          previousStatus: oldStatus,
          newStatus: status,
          changedBy: {
            userId:   req.user._id,
            userName: req.user.name || req.user.email,
            userRole: req.user.role
          },
          changedAt: new Date(),
          comments: comments || `Status updated by admin`
        });

        sale.status = status;
      }

    // ─────────────────────────────────────────────
    // SALESPERSON BRANCH
    // ─────────────────────────────────────────────
    } else {
      const { status, comments, changedAt } = req.body;

      if (!status) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: 'Status is required' });
      }

      if (status === oldStatus) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: 'New status is same as current status' });
      }

      if (!VALID_STATUSES.includes(status)) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
      }

      await applyStockChange(status); // ✅ NOW ACTUALLY RUNS (was missing before)

      sale.statusHistory.push({
        previousStatus: oldStatus,
        newStatus: status,
        changedBy: {
          userId:   req.user._id,
          userName: req.user.name || req.user.email,
          userRole: req.user.role
        },
        changedAt: new Date(),
        comments: comments || `Status updated to ${status}`
      });

      sale.status = status;
    }

    if (!sale.tenantId) sale.tenantId = organizationId;

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
      message: error.message || 'Failed to update sale',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// ✅ FEATURE 1: Soft Delete Sale
// ✅ Soft Delete Sale with ACCOUNT-BASED STOCK RESTORATION
exports.deleteSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { organizationId, _id: userId, name, email } = req.user;

    const sale = await MarketplaceSale.findOne({
      _id: id,
      organizationId,
      deletedAt: null
    }).session(session);

    if (!sale) {
      await session.abortTransaction();
      return res.status(404).json({
        code: 'SALE_NOT_FOUND',
        message: 'Sale not found or already deleted'
      });
    }

    // STEP 1: Restore stock to inventory — only if not already restored via status change
    const product = await Product.findOne(
      { organizationId, design: sale.design, 'colors.color': sale.color }
    ).session(session);

    if (product) {
      const colorVariant = product.colors.find(c => c.color === sale.color);
      if (colorVariant) {
        const sizeVariant = colorVariant.sizes.find(s => s.size === sale.size);
        if (sizeVariant) {

          // ✅ KEY FIX: Check if stock was already restored when status was changed
          // stockRestoredAmount > 0 means returned/cancelled/RTO already gave stock back
          // Restoring again would cause double-restoration (the bug)
          if (sale.stockRestoredAmount > 0) {
            console.log(
              `⏭️  Skipping stock restore on delete — already restored ${sale.stockRestoredAmount} ` +
              `units when status changed to "${sale.status}" for order ${sale.orderItemId}`
            );
            // Do NOT touch inventory at all — just fall through to soft delete
          } else {
            // Stock was never restored (order was dispatched/delivered/wrongreturn)
            // Safe to restore now
            const inventoryMode = sale.inventoryModeUsed || 'reserved';
            console.log(`Restoring ${sale.quantity} units to ${inventoryMode} stock for ${sale.design}-${sale.color}-${sale.size}`);

            if (inventoryMode === 'main') {
              console.log('Before Main:', sizeVariant.currentStock || 0);
              sizeVariant.currentStock = (sizeVariant.currentStock || 0) + sale.quantity;
              console.log('After Main:', sizeVariant.currentStock);
            } else {
              console.log('Before Reserved:', sizeVariant.reservedStock || 0);
              sizeVariant.reservedStock = (sizeVariant.reservedStock || 0) + sale.quantity;
              console.log('After Reserved:', sizeVariant.reservedStock);

              // Restore to account allocation
              const accountName = sale.accountName;
              let allocation = sizeVariant.reservedAllocations?.find(a => a.accountName === accountName);
              if (!allocation) {
                if (!sizeVariant.reservedAllocations) sizeVariant.reservedAllocations = [];
                allocation = { accountName, quantity: 0 };
                sizeVariant.reservedAllocations.push(allocation);
              }
              allocation.quantity += sale.quantity;
              console.log(`Restored ${sale.quantity} units to ${accountName} account allocation`);
            }

            // CRITICAL: Mark nested array as modified for Mongoose to save it
            product.markModified('colors');
            await product.save({ session });
            console.log('Stock restored successfully');
          }
        } else {
          console.warn(`Size ${sale.size} not found in product ${sale.design}-${sale.color}`);
        }
      } else {
        console.warn(`Color ${sale.color} not found in product ${sale.design}`);
      }
    } else {
      console.warn(`Product ${sale.design} not found`);
    }

    // ✅ STEP 2: Soft delete the sale
    sale.deletedAt = new Date();
    sale.deletedBy = userId;
    sale.deletionReason = 'User initiated deletion';
    if (!sale.tenantId) {
      sale.tenantId = organizationId;
    }

    await sale.save({ session });

    // Decrement edit session
    await decrementEditSession(req, 'delete', 'sales', id);

    await session.commitTransaction();

    logger.info('Sale soft deleted', {
      saleId: id,
      deletedBy: name || email,
      stockRestored: sale.quantity,
      accountName: sale.accountName
    });

    const actualRestored = sale.stockRestoredAmount > 0 ? 0 : sale.quantity;
    res.json({ success: true, message: 'Sale deleted successfully', stockRestored: actualRestored, accountName: sale.accountName });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Sale deletion failed', { error: error.message });
    res.status(500).json({
      code: 'DELETE_FAILED',
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

// MODIFIED: Import with SKU mapping support
exports.importFromCSV = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { csvData, accountName, dispatchDate } = req.body;
    const { organizationId, id: userId } = req.user;

    // Validation
    if (!csvData || !Array.isArray(csvData) || csvData.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ 
        code: 'INVALID_DATA', 
        message: 'CSV data is required and must be an array' 
      });
    }

    if (!accountName) {
      await session.abortTransaction();
      return res.status(400).json({ 
        code: 'INVALID_DATA', 
        message: 'Account name is required' 
      });
    }

    if (!dispatchDate) {
      await session.abortTransaction();
      return res.status(400).json({ 
        code: 'INVALID_DATA', 
        message: 'Dispatch date is required' 
      });
    }

    // Get tenant's inventory mode
    const orgSettings = await Settings.findOne({ organizationId }).session(session);
    const inventoryMode = orgSettings?.inventoryMode || 'reserved';

    logger.info('CSV Import using inventory mode', { organizationId, inventoryMode, rowCount: csvData.length });

    const results = { success: [], failed: [], duplicates: [] };

    // STEP 1: Bulk check duplicates
    const orderItemIds = csvData.map(row => row.orderItemId).filter(Boolean);
    const existingOrders = await MarketplaceSale.find({
      orderItemId: { $in: orderItemIds },
      organizationId,
      deletedAt: null
    }).session(session).lean();

    const existingOrderItemIds = new Set(existingOrders.map(o => o.orderItemId));

    // STEP 2: Pre-fetch ALL SKU mappings for this account
    const allMappings = await MarketplaceSKUMapping.find({
      organizationId,
      accountName
    }).session(session).lean();

    // Create SKU lookup map
    const skuMappingMap = new Map();
    allMappings.forEach(mapping => {
      skuMappingMap.set(mapping.marketplaceSKU, {
        design: mapping.design,
        color: mapping.color,
        size: mapping.size
      });
    });

    logger.info('Found existing SKU mappings', { count: skuMappingMap.size });

    // STEP 3: Pre-fetch all products
    const uniqueDesigns = [...new Set(csvData.map(row => row.design))];
    const products = await Product.find({
      design: { $in: uniqueDesigns },
      organizationId
    }).session(session);

    const productMap = new Map();
    products.forEach(product => {
      productMap.set(product.design, product);
    });

    // STEP 4: Process and validate in memory
    const salesToInsert = [];
    const transfersToInsert = [];
    const stockChangesByProduct = new Map();
    const autoInternalTransfers = [];
    const unmappedSKUs = new Set(); // Track SKUs that need mapping

    for (const row of csvData) {
      const { design, color, size, quantity, orderId, orderItemId, trackingId, sku } = row;

      // Check duplicate
      if (existingOrderItemIds.has(orderItemId)) {
        results.duplicates.push({ orderItemId, sku, reason: 'Order already exists' });
        continue;
      }

      let finalDesign, finalColor, finalSize;

      // TRY 1: Check if SKU mapping exists
      if (sku && skuMappingMap.has(sku)) {
        const mapping = skuMappingMap.get(sku);
        finalDesign = mapping.design;
        finalColor = mapping.color;
        finalSize = mapping.size;
        
        logger.info('✅ Used existing SKU mapping', { sku, design: finalDesign, color: finalColor, size: finalSize });
        
        // ✅ FIX: Remove session, or do it AFTER commit in a separate non-transactional call
        // We'll update usage stats without session since it's not critical
        MarketplaceSKUMapping.updateOne(
          { organizationId, accountName, marketplaceSKU: sku },
          { lastUsedAt: new Date(), $inc: { usageCount: 1 } }
        ).exec().catch(err => {
          // Silent fail - usage stats update is not critical
          logger.warn('Failed to update SKU usage stats', { sku, error: err.message });
        });
      }
      // TRY 2: Use current parser (existing logic)
      else if (design && color && size) {
        finalDesign = design;
        finalColor = color;
        finalSize = size;
      }
      // TRY 3: Parse SKU if provided
      else if (sku) {
        const parsed = parseMarketplaceSKU(sku);
        
        if (!parsed.design || !parsed.color || !parsed.size) {
          // Mark as unmapped - need user mapping
          unmappedSKUs.add(sku);
          results.failed.push({
            orderItemId,
            sku,
            reason: 'SKU not mapped. Please map this SKU first.',
            needsMapping: true
          });
          continue;
        }

        finalDesign = parsed.design;
        finalColor = parsed.color;
        finalSize = parsed.size;
      }
      // FAIL: No data available
      else {
        results.failed.push({
          orderItemId,
          sku,
          reason: 'No SKU or product data available'
        });
        continue;
      }

      // Find product from pre-fetched map
      const product = productMap.get(finalDesign);
      if (!product) {
        results.failed.push({
          orderItemId,
          sku,
          reason: `Design "${finalDesign}" not found in inventory`,
          needsMapping: sku ? true : false
        });
        continue;
      }

      // Match color (case-insensitive, fuzzy matching)
      const availableColors = product.colors.map(c => c.color);
      const matchedColor = matchColor(finalColor, availableColors);
      
      if (!matchedColor) {
        results.failed.push({
          orderItemId,
          sku,
          reason: `Color "${finalColor}" not found in design "${finalDesign}". Available: ${availableColors.join(', ')}`,
          needsMapping: sku ? true : false
        });
        continue;
      }

      const colorVariant = product.colors.find(c => c.color === matchedColor);
      const sizeIndex = colorVariant.sizes.findIndex(s => s.size === finalSize);

      if (sizeIndex === -1) {
        results.failed.push({
          orderItemId,
          sku,
          reason: `Size "${finalSize}" not found in ${finalDesign}-${matchedColor}`,
          needsMapping: sku ? true : false
        });
        continue;
      }

      const sizeVariant = colorVariant.sizes[sizeIndex];

      // Check stock based on inventory mode
      const mainStock = sizeVariant.currentStock || 0;
      const reservedStock = sizeVariant.reservedStock || 0;

      if (inventoryMode === 'main') {
        if (mainStock < quantity) {
          results.failed.push({
            orderItemId,
            sku,
            reason: `Insufficient main stock. Available: ${mainStock}, Need: ${quantity}`,
            design: finalDesign,
            color: matchedColor,
            size: finalSize
          });
          continue;
        }
      } else {
      // ✅ RESERVED MODE: Check account allocation first!
      
      // First check total reserved stock
      if (reservedStock < quantity) {
        results.failed.push({
          orderItemId,
          sku,
          reason: `Insufficient reserved stock. Available: ${reservedStock}, Need: ${quantity}`,
          design: finalDesign,
          color: matchedColor,
          size: finalSize
        });
        continue;
      }

      // ✅ NEW: Check account-specific allocation
      let allocation = sizeVariant.reservedAllocations?.find(
        a => a.accountName === accountName
      );

      const accountStock = allocation?.quantity || 0;

      if (accountStock < quantity) {
          // ✅ AUTO INTERNAL TRANSFER: Pull deficit from other accounts
          let deficit = quantity - accountStock;

          // Get other accounts sorted DESC by quantity (most stock first)
          const otherAllocations = (sizeVariant.reservedAllocations || [])
              .filter(a => a.accountName !== accountName && a.quantity > 0)
              .sort((a, b) => b.quantity - a.quantity);

          const totalOtherStock = otherAllocations.reduce((sum, a) => sum + a.quantity, 0);

          if (totalOtherStock < deficit) {
              // Still not enough even across all accounts — genuinely fail
              results.failed.push({
                  orderItemId,
                  sku,
                  reason: `Insufficient stock for "${accountName}" across all accounts. Account: ${accountStock}, All other accounts total: ${totalOtherStock}, Need: ${quantity}`,
                  design: finalDesign,
                  color: matchedColor,
                  size: finalSize,
                  accountName,
                  accountStock,
                  totalOtherStock,
              });
              continue;
          }

          // ✅ Greedy loop: transfer from highest-stock account first
          for (const sourceAlloc of otherAllocations) {
              if (deficit <= 0) break;

              const transferQty = Math.min(sourceAlloc.quantity, deficit);
              const sourceQtyBefore = sourceAlloc.quantity;

              // Ensure destination allocation entry exists in the live Mongoose doc
              let destAlloc = sizeVariant.reservedAllocations?.find(a => a.accountName === accountName);
              if (!destAlloc) {
                  if (!sizeVariant.reservedAllocations) sizeVariant.reservedAllocations = [];
                  sizeVariant.reservedAllocations.push({ accountName, quantity: 0 });
                  destAlloc = sizeVariant.reservedAllocations[sizeVariant.reservedAllocations.length - 1];
                  allocation = destAlloc; // update outer reference
              }

              const destQtyBefore = destAlloc.quantity;

              // ✅ In-memory transfer (modifies live Mongoose doc — visible to later rows too)
              sourceAlloc.quantity -= transferQty;
              destAlloc.quantity += transferQty;
              deficit -= transferQty;

              // Track for STEP 8 logging
              autoInternalTransfers.push({
                  productId: product._id.toString(),
                  design: finalDesign,
                  color: matchedColor,
                  size: finalSize,
                  fromAccount: sourceAlloc.accountName,
                  toAccount: accountName,
                  quantity: transferQty,
                  sourceQtyBefore,
                  sourceQtyAfter: sourceAlloc.quantity,
                  destQtyBefore,
                  destQtyAfter: destAlloc.quantity,
                  mainStock: sizeVariant.currentStock || 0,       // unchanged by internal transfer
                  reservedStock: sizeVariant.reservedStock || 0,  // unchanged by internal transfer
              });

              logger.info('✅ Auto internal transfer during CSV import', {
                  design: finalDesign, color: matchedColor, size: finalSize,
                  from: sourceAlloc.accountName, to: accountName,
                  quantity: transferQty, orderItemId
              });
          }

          // Re-read allocation reference (in case it was just created above)
          allocation = sizeVariant.reservedAllocations?.find(a => a.accountName === accountName);
      }
    }

    if (inventoryMode === 'reserved') {
      // Deduct from this account's allocation (in-memory, visible to later rows)
      const runningAlloc = sizeVariant.reservedAllocations?.find(a => a.accountName === accountName);
      if (runningAlloc) runningAlloc.quantity -= quantity;
    } else {
      // Main mode: decrement currentStock in-memory NOW so subsequent CSV rows
      // see the updated value — prevents multi-row oversell within same import
      sizeVariant.currentStock = (sizeVariant.currentStock || 0) - quantity;
    }

      // Track stock changes
      const productId = product._id.toString();
      if (!stockChangesByProduct.has(productId)) {
        stockChangesByProduct.set(productId, []);
      }

      stockChangesByProduct.get(productId).push({
        design: finalDesign,
        color: matchedColor,
        size: finalSize,
        quantity,
        sizeIndex,
        mainBefore: mainStock,
        reservedBefore: reservedStock
      });

      // Prepare sale document
      salesToInsert.push({
        accountName,
        marketplaceOrderId: orderId,
        orderItemId,
        trackingId: trackingId || null,   
        design: finalDesign,
        color: matchedColor,
        size: finalSize,
        quantity,
        saleDate: new Date(dispatchDate),
        status: 'dispatched',
        notes: 'Imported from CSV',
        organizationId,
        tenantId: organizationId,
        inventoryModeUsed: inventoryMode,
        createdByUser: {
          userId,
          userName: req.user.name || req.user.email,
          userRole: req.user.role,
          createdAt: new Date()
        }
      });

      results.success.push({ orderItemId, sku });
    }

        // STEP 5: Apply stock changes and save products
    for (const [productId, changes] of stockChangesByProduct.entries()) {
      const product = products.find(p => p._id.toString() === productId);

      for (const change of changes) {
        const colorVariant = product.colors.find(c => c.color === change.color);
        
        if (inventoryMode === 'main') {
          // ✅ currentStock already decremented in-memory in STEP 4
          // No further deduction needed — just markModified + save
        } else {
          // RESERVED MODE: only deduct reservedStock total
          // allocation.quantity was already deducted per-row in STEP 4
          const sizeVariant = colorVariant.sizes[change.sizeIndex];
          sizeVariant.reservedStock -= change.quantity;
        }
      }

      product.markModified('colors');
      await product.save({ session });
    }

    // STEP 6: Bulk insert sales
    let insertedSales = [];
    if (salesToInsert.length > 0) {
      insertedSales = await MarketplaceSale.insertMany(salesToInsert, { session });
      logger.info('Bulk inserted sales', { count: insertedSales.length });
    }

    // STEP 7: Create transfer logs
    for (let i = 0; i < insertedSales.length; i++) {
      const sale = insertedSales[i];
      const change = Array.from(stockChangesByProduct.values())
        .flat()
        .find(c => 
          c.design === sale.design && 
          c.color === sale.color && 
          c.size === sale.size
        );

      if (change) {
        transfersToInsert.push({
          design: sale.design,
          color: sale.color,
          size: sale.size,
          quantity: sale.quantity,
          type: 'marketplaceorder',
          from: inventoryMode === 'main' ? 'main' : 'reserved',
          to: 'sold',
          mainStockBefore: change.mainBefore,
          reservedStockBefore: change.reservedBefore,
          mainStockAfter: inventoryMode === 'main' ? change.mainBefore - sale.quantity : change.mainBefore,
          reservedStockAfter: inventoryMode === 'reserved' ? change.reservedBefore - sale.quantity : change.reservedBefore,
          relatedOrderId: sale._id,
          relatedOrderType: 'marketplace',
          performedBy: userId,
          notes: `Marketplace order ${sale.marketplaceOrderId} created via CSV import`,
          organizationId
        });
      }
    }

    if (transfersToInsert.length > 0) {
      await Transfer.insertMany(transfersToInsert, { session });
      logger.info('Created transfer logs', { count: transfersToInsert.length });
    }

    // ✅ STEP 8: Log auto internal transfers (AllocationChange + Transfer records)
    if (autoInternalTransfers.length > 0) {
        const allocationChangesToInsert = [];
        const autoTransferLogsToInsert = [];

        for (const transfer of autoInternalTransfers) {
            // Source account — stock went OUT
            allocationChangesToInsert.push({
                productId: transfer.productId,
                design: transfer.design,
                color: transfer.color,
                size: transfer.size,
                accountName: transfer.fromAccount,
                quantityBefore: transfer.sourceQtyBefore,
                quantityAfter: transfer.sourceQtyAfter,
                amountChanged: -transfer.quantity,
                changeType: 'internal_transfer_out',
                relatedOrderType: null,
                changedBy: userId,
                notes: `Auto internal transfer to "${transfer.toAccount}" (${transfer.quantity} units) — triggered by CSV import`,
                organizationId
            });

            // Destination account — stock came IN
            allocationChangesToInsert.push({
                productId: transfer.productId,
                design: transfer.design,
                color: transfer.color,
                size: transfer.size,
                accountName: transfer.toAccount,
                quantityBefore: transfer.destQtyBefore,
                quantityAfter: transfer.destQtyAfter,
                amountChanged: transfer.quantity,
                changeType: 'internal_transfer_in',
                relatedOrderType: null,
                changedBy: userId,
                notes: `Auto internal transfer from "${transfer.fromAccount}" (${transfer.quantity} units) — triggered by CSV import`,
                organizationId
            });

            // Transfer record (shows in Transfer History)
            autoTransferLogsToInsert.push({
                design: transfer.design,
                color: transfer.color,
                size: transfer.size,
                quantity: transfer.quantity,
                type: 'internal_transfer',
                from: `reserved-${transfer.fromAccount}`,
                to: `reserved-${transfer.toAccount}`,
                mainStockBefore: transfer.mainStock,
                reservedStockBefore: transfer.reservedStock,
                mainStockAfter: transfer.mainStock,      // unchanged — only allocation moved
                reservedStockAfter: transfer.reservedStock, // unchanged
                performedBy: userId,
                notes: `Auto internal transfer: "${transfer.fromAccount}" → "${transfer.toAccount}" (${transfer.quantity} units) — CSV import`,
                organizationId
            });
        }

        await AllocationChange.insertMany(allocationChangesToInsert, { session });
        await Transfer.insertMany(autoTransferLogsToInsert, { session });

        logger.info('✅ Auto internal transfers logged', {
            transfers: autoInternalTransfers.length,
            allocationChanges: allocationChangesToInsert.length
        });
    }

    await session.commitTransaction();

    // Return results with unmapped SKUs info
    res.json({
      success: true,
      data: {
        success: results.success,
        failed: results.failed,
        duplicates: results.duplicates,
        unmappedSKUs: Array.from(unmappedSKUs),
        needsMapping: unmappedSKUs.size > 0,
        autoTransfers: autoInternalTransfers.length,
        autoTransferDetails: autoInternalTransfers.map(t => ({
            design: t.design,
            color: t.color,
            size: t.size,
            fromAccount: t.fromAccount,
            toAccount: t.toAccount,
            quantity: t.quantity
        }))
      }
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('CSV import failed', { error: error.message });
    res.status(500).json({
      code: 'IMPORT_FAILED',
      message: 'Failed to import CSV',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

exports.detectCSVType = async (req, res) => {
  try {
    const { headers } = req.body;

    if (!headers || !Array.isArray(headers) || headers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'headers array is required',
      });
    }

    const csvType = detectFlipkartCSVType(headers);

    const messages = {
      return:   'Flipkart Return CSV detected',
      dispatch: 'Flipkart Dispatch/Order CSV detected',
      unknown:  'Unrecognized CSV format — please verify the file',
    };

    return res.json({
      success: true,
      csvType,
      message: messages[csvType],
    });
  } catch (error) {
    logger.error('detectCSVType error:', error);
    return res.status(500).json({ success: false, message: 'Failed to detect CSV type' });
  }
};

// ─── ENDPOINT: Preview Return CSV (dry-run, no DB writes) ─────────────────
// POST /api/sales/preview-return-csv
// Body: { rows: object[] }  ← parsed CSV rows from frontend
// Returns matched/unmatched summary so user can confirm before importing
// ──────────────────────────────────────────────────────────────────────────
exports.previewReturnCSV = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { rows } = req.body;

    if (!rows || !Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({ success: false, message: 'No CSV rows provided' });

    const firstRowKeys = Object.keys(rows[0] || {});
    if (detectFlipkartCSVType(firstRowKeys) !== 'return')
      return res.status(400).json({
        success: false,
        message: 'This does not appear to be a Flipkart Return CSV. Please upload the correct file.',
        detectedType: detectFlipkartCSVType(firstRowKeys),
      });

    const matched = [];
    const unmatched = [];
    let skipped = 0;

    for (const row of rows) {
      // ✅ Strip Excel's leading apostrophe
      const orderItemId = row['Order Item ID']?.trim().replace(/^'/, '') || null;
      const orderId     = row['Order ID']?.trim() || null;

      // ✅ Skip entirely empty rows
      if (!orderItemId && !orderId) { results.skipped++; continue; }

      // ✅ Declare ALL row variables BEFORE they are used below
      const returnType      = row['Return Type']?.trim()       || null;
      const returnReason    = row['Return Reason']?.trim()     || null;
      const returnSubReason = row['Return Sub-reason']?.trim() || null;
      const trackingId      = row['Tracking ID']?.trim()       || null;
      const returnId        = row['Return ID']?.trim()         || null;
      const comments        = row['Comments']?.trim()          || null;

      // ✅ Regex matches both 'OD12345 (old stored) and OD12345 (clean)
      const query = { organizationId, deletedAt: null };
      if (orderItemId && orderId) {
        query.orderItemId        = { $regex: `^'?${escapeRegex(orderItemId)}$` };
        query.marketplaceOrderId = orderId;
      } else if (orderItemId) {
        query.orderItemId = { $regex: `^'?${escapeRegex(orderItemId)}$` };
      } else {
        query.marketplaceOrderId = orderId;
      }

      const sale = await MarketplaceSale.findOne(query)
        .select('orderItemId marketplaceOrderId trackingId returnTrackingId design color size status accountName returnReason returnSubReason returnComments')
        .lean();

      const isRTO            = (returnType || '').toLowerCase().includes('rto');
      const willStoreTracking = !isRTO && !!trackingId;

      if (sale) {
        matched.push({
          orderItemId:            sale.orderItemId,
          orderId:                sale.marketplaceOrderId,
          design:                 sale.design,
          color:                  sale.color,
          size:                   sale.size,
          accountName:            sale.accountName,
          currentStatus:          sale.status,
          forwardTrackingId:      sale.trackingId        || null,
          existingReturnTracking: sale.returnTrackingId  || null,
          returnId,
          returnType,
          returnReason,
          returnSubReason,
          comments,
          newReturnTrackingId: willStoreTracking ? trackingId : null,
          isRTO,
          willStoreTracking,
          note: isRTO
            ? 'RTO order — tracking ID will NOT be stored'
            : willStoreTracking
              ? 'Customer return — tracking ID will be stored'
              : 'No tracking ID in CSV row',
        });
      } else {
        unmatched.push({ orderItemId, orderId, returnType, returnReason });
      }
    }

    return res.json({
      success: true,
      data: {
        totalRows:      rows.length,
        matchedCount:   matched.length,
        unmatchedCount: unmatched.length,
        skippedCount:   skipped,
        matched,
        unmatched,
      },
    });

  } catch (error) {
    logger.error('previewReturnCSV error:', error);
    return res.status(500).json({ success: false, message: 'Failed to preview return CSV' });
  }
};

// ─── ENDPOINT: Import Return CSV (actual DB writes) ───────────────────────
// POST /api/sales/import-return-csv
// Body: { rows: object[] }  ← parsed CSV rows from frontend
// ──────────────────────────────────────────────────────────────────────────
exports.importReturnCSV = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { rows } = req.body;

    // ── Validation ──────────────────────────────────────────────────────────
    if (!rows || !Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({ success: false, message: 'No CSV rows provided' });

    const firstRowKeys = Object.keys(rows[0] || {});
    if (detectFlipkartCSVType(firstRowKeys) !== 'return')
      return res.status(400).json({
        success: false,
        message: 'This does not appear to be a Flipkart Return CSV. Please upload the correct file.',
        detectedType: detectFlipkartCSVType(firstRowKeys),
      });

    // ── Helpers ─────────────────────────────────────────────────────────────
    const parseFlipkartDate = (dateStr) => {
      if (!dateStr || !dateStr.trim() || dateStr.trim() === '-') return null;
      const d = new Date(dateStr.trim());
      return isNaN(d.getTime()) ? null : d;
    };

    const results = {
      updated:         0,
      unmatched:       0,
      skipped:         0,
      rtoCount:        0,  // ✅ ADD — count of RTO rows (tracking skipped)
      trackingStored:  0,  // ✅ ADD — count where returnTrackingId was saved
      errors:          [],
      unmatchedOrders: [],
    };

    // ── STEP 1: Extract & clean IDs from ALL rows upfront ───────────────────
    // (same as importFromCSV STEP 1 bulk duplicate check)
    const csvItems = [];
    for (const row of rows) {
      const orderItemId = row['Order Item ID']?.trim().replace(/^'/, '') || null;
      const orderId     = row['Order ID']?.trim() || null;

      if (!orderItemId && !orderId) {
        results.skipped++;
        continue;
      }

      csvItems.push({ orderItemId, orderId, row });
    }

    if (csvItems.length === 0) {
      return res.status(200).json({
        success: true,
        message: `No valid rows to process. ${results.skipped} rows skipped.`,
        data: results,
      });
    }

    // ── STEP 2: ONE bulk query — prefetch all matching sales at once ─────────
    // (same as importFromCSV STEP 1 existingOrders bulk find)
    const allOrderItemIds = csvItems.map(i => i.orderItemId).filter(Boolean);
    const allOrderIds     = csvItems.map(i => i.orderId).filter(Boolean);

    const matchedSales = await MarketplaceSale.find({
      organizationId,
      deletedAt: null,
      $or: [
        ...(allOrderItemIds.length > 0
          ? [{ orderItemId: { $in: allOrderItemIds.flatMap(id => [id, `'${id}`]) } }]
          : []),
        ...(allOrderIds.length > 0
          ? [{ marketplaceOrderId: { $in: allOrderIds } }]
          : []),
      ],
    }).lean();

    logger.info('Return CSV: bulk fetched matching sales', {
      organizationId,
      csvRows:      csvItems.length,
      salesFetched: matchedSales.length,
    });

    // ── STEP 3: Build in-memory lookup maps — O(1) per row ──────────────────
    // (same as importFromCSV skuMappingMap + productMap pattern)
    const byOrderItemId = new Map(); // stripped orderItemId → sale
    const byOrderId     = new Map(); // marketplaceOrderId   → sale

    for (const sale of matchedSales) {
      if (sale.orderItemId) {
        byOrderItemId.set(sale.orderItemId.replace(/^'/, ''), sale);
      }
      if (sale.marketplaceOrderId) {
        byOrderId.set(sale.marketplaceOrderId, sale);
      }
    }

    // ── STEP 4: Process all rows in memory — ZERO DB calls in this loop ──────
    // (same as importFromCSV STEP 4 in-memory processing loop)
    const bulkOps = []; // collect all updateOne ops

    for (const item of csvItems) {
      try {
        const { orderItemId, orderId, row } = item;

        // Lookup from in-memory map — no DB call at all
        const sale =
          (orderItemId && byOrderItemId.get(orderItemId)) ||
          (orderId     && byOrderId.get(orderId))         ||
          null;

        if (!sale) {
          results.unmatched++;
          results.unmatchedOrders.push({
            orderItemId,
            orderId,
            returnType:   row['Return Type']?.trim()   || null,
            returnReason: row['Return Reason']?.trim() || null,
          });
          continue;
        }

        // Parse all fields
        const returnType          = row['Return Type']?.trim()       || null;
        const returnReason        = row['Return Reason']?.trim()     || null;
        const returnSubReason     = row['Return Sub-reason']?.trim() || null;
        const trackingId          = row['Tracking ID']?.trim()       || null;
        const returnId            = row['Return ID']?.trim()         || null;
        const returnStatus        = row['Return Status']?.trim()     || null;
        const returnRequestedDate = parseFlipkartDate(row['Return Requested Date']);
        const returnCompletedDate = parseFlipkartDate(row['Completed Date']);
        const returnComments      = row['Comments']?.trim()          || null;

        // RTO rule — don't store tracking ID for courier returns
        const isRTO            = returnType === 'courier_return';
        const returnTrackingId = (!isRTO && trackingId) ? trackingId : null;

        // Only set non-null values — re-imports won't blank out existing fields
        const updateFields = {};
        if (returnId)            updateFields.returnId            = returnId;
        if (returnType)          updateFields.returnType          = returnType;
        if (returnReason)        updateFields.returnReason        = returnReason;
        if (returnSubReason)     updateFields.returnSubReason     = returnSubReason;
        if (returnStatus)        updateFields.returnStatus        = returnStatus;
        if (returnRequestedDate) updateFields.returnRequestedDate = returnRequestedDate;
        if (returnCompletedDate) updateFields.returnCompletedDate = returnCompletedDate;
        if (returnTrackingId)    updateFields.returnTrackingId    = returnTrackingId;
        if (returnComments)      updateFields.returnComments      = returnComments;

        // Queue update op — no DB call yet
        bulkOps.push({
          updateOne: {
            filter: { _id: sale._id },
            update: { $set: updateFields },
          },
        });

        if (isRTO) {
        results.rtoCount++;
      } else if (returnTrackingId) {
        results.trackingStored++;
      }
        results.updated++;

      } catch (rowError) {
        results.errors.push({
          orderItemId: item.orderItemId || 'unknown',
          error: rowError.message,
        });
        logger.error('Return CSV row error:', {
          orderItemId: item.orderItemId,
          error: rowError.message,
        });
      }
    }

    // ── STEP 5: ONE bulkWrite — all updates in a single DB round trip ────────
    // (same as importFromCSV STEP 6 insertMany pattern)
    if (bulkOps.length > 0) {
      await MarketplaceSale.bulkWrite(bulkOps, { ordered: false });
      // ordered: false — one bad op won't abort the rest
      logger.info('Return CSV: bulk write complete', {
        organizationId,
        updated:  results.updated,
        bulkOps:  bulkOps.length,
      });
    }

    logger.info('Return CSV import complete', {
      organizationId,
      updated:   results.updated,
      unmatched: results.unmatched,
      skipped:   results.skipped,
      errors:    results.errors.length,
      dbCalls:   '2 total (1 find + 1 bulkWrite)',
    });

    return res.status(200).json({
      success: true,
      message: `Return CSV imported: ${results.updated} updated, ${results.unmatched} unmatched, ${results.skipped} skipped`,
      data: results,
    });

  } catch (error) {
    logger.error('importReturnCSV error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error processing return CSV',
      error: error.message,
    });
  }
};

// ✅ ADD THIS - Get date summary
exports.getDateSummary = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { status, accountName, startDate, endDate } = req.query;

    const filter = { organizationId, deletedAt: null };

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

    const dateSummary = await MarketplaceSale.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$saleDate' }
          },
          count: { $sum: 1 },
          accounts: { $addToSet: '$accountName' }
        }
      },
      { $sort: { _id: -1 } },
      {
        $project: {
          date: '$_id',
          count: 1,
          accounts: 1,
          _id: 0
        }
      }
    ]);

    res.json({
      success: true,
      data: dateSummary
    });
  } catch (error) {
    console.error('Get date summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch date summary',
      error: error.message
    });
  }
};

// ✅ ADD THIS - Get orders by specific date
exports.getOrdersByDate = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { date, status, accountName } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required'
      });
    }

    const filter = { organizationId, deletedAt: null };

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    filter.saleDate = {
      $gte: startOfDay,
      $lte: endOfDay
    };

    if (status && status !== 'all') {
      const statuses = status.split(',').map(s => s.trim());
      filter.status = { $in: statuses };
    }

    if (accountName && accountName !== 'all') {
      filter.accountName = accountName;
    }

    const orders = await MarketplaceSale.find(filter)
      .sort({ createdAt: -1 })
      .lean()
      .maxTimeMS(10000);

    res.json({
      success: true,
      data: orders,
      count: orders.length,
      date: date
    });
  } catch (error) {
    console.error('Get orders by date error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
};

// ✅ CLEAN - Global search (Order ID / text / status keyword)
exports.searchOrderGlobally = async (req, res) => {
  try {
    const { query, statusFilter } = req.query;
    const organizationId = req.organizationId; // ← FIXED: destructure correctly

    console.log('SEARCH orgId:', organizationId, 'user._id:', req.user._id, 'user.orgId:', req.user.organizationId);
    
    // STATUS-BASED SEARCH (when user types "rto", "returned", etc.)
    if (statusFilter) {
      const orders = await MarketplaceSale.find({
        organizationId,
        deletedAt: null,
        status: statusFilter
      })
        .sort({ saleDate: -1 })
        .limit(200)
        .lean();

      if (orders.length === 0) return res.json({ found: false, orders: [], count: 0 });

      const byStatus = orders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {});

      return res.json({ found: true, orders, count: orders.length, byStatus });
    }

    // NORMAL TEXT SEARCH (Order ID / design / color / size)
    if (!query || query.trim().length < 2) {
      return res.json({ found: false, orders: [], count: 0 });
    }

    const searchTerm = query.trim();

    const orders = await MarketplaceSale.find({
      organizationId,
      deletedAt: null,
      $or: [
        { orderItemId: { $regex: searchTerm, $options: 'i' } },
        { marketplaceOrderId: { $regex: searchTerm, $options: 'i' } },
        { trackingId: { $regex: searchTerm, $options: 'i' } },  
        { returnTrackingId: { $regex: searchTerm, $options: 'i' } },
        { design: { $regex: searchTerm, $options: 'i' } },
        { color: { $regex: searchTerm, $options: 'i' } },
        { size: { $regex: searchTerm, $options: 'i' } }
      ]
    })
      .sort({ saleDate: -1 })
      .limit(100)
      .lean();

    if (orders.length === 0) return res.json({ found: false, orders: [], count: 0 });

    const byStatus = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});

    res.json({
      found: true,
      orders,
      count: orders.length,
      byStatus,
      uniqueStatuses: [...new Set(orders.map(o => o.status))]
    });

  } catch (error) {
    logger.error('Global search failed', { error: error.message });
    res.status(500).json({ success: false, message: 'Search failed', error: error.message });
  }
};

// ✅ CLEAN - Search by date (separate function, untouched)
exports.searchByDate = async (req, res) => {
  try {
    const { date, accountName, status } = req.query;
    const organizationId = req.organizationId;  // ← already correct

    if (!date) {
      return res.status(400).json({ success: false, message: 'Date parameter is required' });
    }

    const filter = { organizationId, deletedAt: null };

    if (accountName && accountName !== 'all') filter.accountName = accountName;

    if (status && status !== 'all') {
      const statuses = status.split(',').map(s => s.trim());
      filter.status = { $in: statuses };
    }

    const allOrders = await MarketplaceSale.find(filter)
      .sort({ saleDate: -1 })
      .lean()
      .maxTimeMS(10000);

    const orders = allOrders.filter(order => getDisplayDate(order) === date);

    const ordersWithDisplayDate = orders.map(order => ({
      ...order,
      displayDate: getDisplayDate(order)
    }));

    if (ordersWithDisplayDate.length === 0) {
      return res.json({ found: false, orders: [], count: 0 });
    }

    const byStatus = ordersWithDisplayDate.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});

    res.json({
      found: true,
      orders: ordersWithDisplayDate,
      count: ordersWithDisplayDate.length,
      byStatus,
      uniqueStatuses: [...new Set(ordersWithDisplayDate.map(o => o.status))]
    });

  } catch (error) {
    logger.error('Date search failed', { error: error.message });
    res.status(500).json({ success: false, message: 'Date search failed', error: error.message });
  }
};

exports.getDateSummaries = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { accountName, status, startDate, endDate } = req.query;

    const matchFilter = { organizationId, deletedAt: null };
    if (accountName && accountName !== 'all') matchFilter.accountName = accountName;
    if (status && status !== 'all') {
      matchFilter.status = { $in: status.split(',').map(s => s.trim()) };
    }

    const pipeline = [
      { $match: matchFilter },
      {
        $addFields: {
          displayDate: {
            $cond: {
              if: { $in: ['$status', ['returned', 'cancelled', 'wrongreturn', 'RTO']] },
              then: {
                $let: {
                  vars: {
                    matchingHistory: {
                      $filter: {
                        input: { $ifNull: ['$statusHistory', []] },
                        cond: { $in: ['$$this.newStatus', ['returned', 'cancelled', 'wrongreturn', 'RTO']] }
                      }
                    }
                  },
                  in: {
                    $cond: {
                      if: { $gt: [{ $size: '$$matchingHistory' }, 0] },
                      then: {
                        $dateToString: {
                          format: '%Y-%m-%d',
                          date: { $arrayElemAt: ['$$matchingHistory.changedAt', -1] }
                        }
                      },
                      else: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } }
                    }
                  }
                }
              },
              else: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } }
            }
          }
        }
      },
      // Apply date range AFTER computing displayDate
      ...(startDate || endDate ? [{
        $match: {
          displayDate: {
            ...(startDate ? { $gte: startDate } : {}),
            ...(endDate ? { $lte: endDate } : {})
          }
        }
      }] : []),
      {
        $group: {
          _id: '$displayDate',
          count: { $sum: 1 },
          accounts: { $push: '$accountName' }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 90 }
    ];

    const summaries = await MarketplaceSale.aggregate(pipeline, { maxTimeMS: 15000 });

    const result = summaries.map(s => {
      const accountBreakdown = {};
      s.accounts.forEach(acc => {
        accountBreakdown[acc] = (accountBreakdown[acc] || 0) + 1;
      });
      return { date: s._id, count: s.count, accountBreakdown };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('getDateSummaries failed', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch date summaries', error: error.message });
  }
};

exports.getOrdersForDate = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { date, accountName, status } = req.query;

    if (!date) return res.status(400).json({ message: 'date is required' });

    const matchFilter = { organizationId, deletedAt: null };
    if (accountName && accountName !== 'all') matchFilter.accountName = accountName;
    if (status && status !== 'all') {
      matchFilter.status = { $in: status.split(',').map(s => s.trim()) };
    }

    const pipeline = [
      { $match: matchFilter },
      {
        $addFields: {
          displayDate: {
            $cond: {
              if: { $in: ['$status', ['returned', 'cancelled', 'wrongreturn', 'RTO']] },
              then: {
                $let: {
                  vars: {
                    matchingHistory: {
                      $filter: {
                        input: { $ifNull: ['$statusHistory', []] },
                        cond: { $in: ['$$this.newStatus', ['returned', 'cancelled', 'wrongreturn', 'RTO']] }
                      }
                    }
                  },
                  in: {
                    $cond: {
                      if: { $gt: [{ $size: '$$matchingHistory' }, 0] },
                      then: {
                        $dateToString: {
                          format: '%Y-%m-%d',
                          date: { $arrayElemAt: ['$$matchingHistory.changedAt', -1] }
                        }
                      },
                      else: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } }
                    }
                  }
                }
              },
              else: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } }
            }
          }
        }
      },
      { $match: { displayDate: date } },
      { $sort: { saleDate: -1, createdAt: -1 } },
      { $project: { __v: 0, editHistory: 0 } }
    ];

    const orders = await MarketplaceSale.aggregate(pipeline, { maxTimeMS: 10000 });
    res.json({ success: true, data: orders });
  } catch (error) {
    logger.error('getOrdersForDate failed', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch orders for date', error: error.message });
  }
};
