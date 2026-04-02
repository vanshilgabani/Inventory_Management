const Product = require('../models/Product');
const Settings = require('../models/Settings');
const AllocationChange = require('../models/AllocationChange');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// ✅ ADD THIS - Global flag to disable locked stock
const STOCK_LOCK_DISABLED = true;

// Helper to check if we should use locked stock
const shouldUseLockStock = () => {
  if (STOCK_LOCK_DISABLED) return false; // Force disable
  return false; // Always disabled
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


// 🔒 UPDATED: Get all products with available stock calculation
// @desc Get all products
// @route GET /api/inventory
// @access Private
// Get all products
const getAllProducts = async (req, res) => {
  try {
    const organizationId = req.organizationId || req.user?.organizationId;

    // ⭐ FIX: Don't use .lean() - it might not include nested arrays properly
    const products = await Product.find({ organizationId })
      .sort({ design: 1 });

    // Convert to plain objects and explicitly include reservedAllocations
    const enrichedProducts = products.map(product => {
      const plainProduct = product.toObject();
      return {
        ...plainProduct,
        colors: plainProduct.colors?.map(color => ({
          ...color,
          sizes: color.sizes?.map(size => ({
            ...size,
            currentStock: size.currentStock || 0,
            reservedStock: size.reservedStock || 0,
            lockedStock: size.lockedStock || 0,
            reservedAllocations: size.reservedAllocations || [] // ⭐ EXPLICIT
          }))
        }))
      };
    });

    console.log('✅ getAllProducts - Sample allocation:', 
      enrichedProducts[0]?.colors?.[0]?.sizes?.[0]?.reservedAllocations
    );

    res.json(enrichedProducts);
  } catch (error) {
    console.error('Failed to fetch products', error);
    res.status(500).json({ 
      code: 'FETCH_FAILED', 
      message: 'Failed to fetch products',
      error: error.message 
    });
  }
};

// @desc Create product
// @route POST /api/inventory
// @access Private
const createProduct = async (req, res) => {
  try {
    console.log('📦 Creating product with data:', JSON.stringify(req.body, null, 2));
    console.log('🔐 Organization ID:', req.organizationId);

    const { design, description, colors } = req.body;

    // ✅ VALIDATE required fields
    if (!design || !design.trim()) {
      return res.status(400).json({ message: 'Design name is required' });
    }

    if (!colors || !Array.isArray(colors) || colors.length === 0) {
      return res.status(400).json({
        message: 'Colors array is required and must contain at least one color',
      });
    }

    // Check if product already exists
    const existingProduct = await Product.findOne({
      design,
      organizationId: req.organizationId,
    });

    if (existingProduct) {
      return res.status(400).json({ message: 'Product with this design already exists' });
    }

    // ✅ Get enabled sizes from settings
    let settings = await Settings.findOne({ organizationId: req.organizationId });
    if (!settings) {
      console.log('⚠️ No settings found, creating default settings');
      settings = await Settings.create({
        organizationId: req.organizationId,
        enabledSizes: ['S', 'M', 'L', 'XL', 'XXL'],
        availableSizes: [
          { size: 'S', enabled: true, displayOrder: 0 },
          { size: 'M', enabled: true, displayOrder: 1 },
          { size: 'L', enabled: true, displayOrder: 2 },
          { size: 'XL', enabled: true, displayOrder: 3 },
          { size: 'XXL', enabled: true, displayOrder: 4 },
        ],
      });
    }

    // ✅ Get enabled sizes using helper method or fallback
    const enabledSizes = settings.getEnabledSizes
      ? settings.getEnabledSizes()
      : settings.enabledSizes || ['S', 'M', 'L', 'XL', 'XXL'];

    console.log('✅ Enabled sizes:', enabledSizes);

    // ✅ Validate colors data
    const colorVariants = colors.map((colorData) => {
      console.log('Processing color:', colorData);

      if (!colorData.color) {
        throw new Error('Color name is required for each color variant');
      }

      return {
        color: colorData.color,
        wholesalePrice: Number(colorData.wholesalePrice) || 0,
        retailPrice: Number(colorData.retailPrice) || 0,
        sizes: enabledSizes.map((size) => {
          const providedSize = colorData.sizes?.find((s) => s.size === size);
          return {
            size: size,
            currentStock: providedSize ? Number(providedSize.currentStock) || 0 : 0,
            reorderPoint: 20,
          };
        }),
      };
    });

    console.log('✅ Color variants built:', JSON.stringify(colorVariants, null, 2));

    const product = await Product.create({
      design: design.trim(),
      description: description ? description.trim() : '',
      colors: colorVariants,
      organizationId: req.organizationId,
    });

    console.log('✅ Product created successfully:', product._id);

    res.status(201).json(product);
  } catch (error) {
    console.error('❌ Create product error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      message: error.message || 'Failed to create product',
    });
  }
};

// 🔒 UPDATED: Get product by ID with available stock
// @desc Get product by ID
// @route GET /api/inventory/:id
// @access Private
const getProductById = async (req, res) => {
  try {
    const organizationId = req.organizationId;

    // Fetch stock lock settings
    const settings = await Settings.findOne({ organizationId });
    const stockLockEnabled = shouldUseLockStock() && (settings?.stockLockEnabled || false);
    const stockLockValue = shouldUseLockStock() ? (settings?.stockLockValue || 0) : 0;
    const maxStockLockThreshold = settings?.maxStockLockThreshold || 0;

    const product = await Product.findById(req.params.id);

    if (product) {
      const productObj = product.toObject();

      // Calculate available stock
      productObj.colors = productObj.colors.map((color) => {
        return {
          ...color,
          sizes: color.sizes.map((size) => {
            const currentStock = size.currentStock || 0;
            const availableStock = stockLockEnabled
              ? Math.max(0, currentStock - stockLockValue)
              : currentStock;

            return {
              ...size,
              availableStock,
            };
          }),
        };
      });

      res.json({
        product: productObj,
        stockLockSettings: {
          enabled: stockLockEnabled,
          lockValue: stockLockValue,
          maxThreshold: maxStockLockThreshold,
        },
      });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Update product
// @route PUT /api/inventory/:id
// @access Private
const updateProduct = async (req, res) => {
  try {
    const { design, description, colors } = req.body;

    const product = await Product.findOne({
      _id: req.params.id,
      organizationId: req.organizationId,
    });

    if (product) {
      product.design = design || product.design;
      product.description = description || product.description;

      if (colors && Array.isArray(colors)) {
        // ✅ Get enabled sizes from settings
        let settings = await Settings.findOne({ organizationId: req.organizationId });
        if (!settings) {
          settings = await Settings.create({
            organizationId: req.organizationId,
            enabledSizes: ['S', 'M', 'L', 'XL', 'XXL'],
          });
        }

        const enabledSizes = settings.enabledSizes;

        product.colors = colors.map((color) => ({
          color: color.color,
          wholesalePrice: color.wholesalePrice || 0,
          retailPrice: color.retailPrice || 0,
          sizes:
            color.sizes ||
            enabledSizes.map((size) => ({
              size: size,
              currentStock: 0,
              reorderPoint: 20,
            })),
        }));
      }

      const updatedProduct = await product.save();
      await decrementEditSession(req, 'edit', 'inventory', req.params.id);
      res.json(updatedProduct);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Delete product
// @route DELETE /api/inventory/:id
// @access Private
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      organizationId: req.organizationId,
    });

    if (product) {
      await product.deleteOne();
      await decrementEditSession(req, 'edit', 'inventory', req.params.id);
      res.json({ message: 'Product removed' });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ UPDATED: Get low stock items using new threshold logic
// @desc Get low stock items based on settings thresholds
// @route GET /api/inventory/low-stock
// @access Private
const getLowStockItems = async (req, res) => {
  try {
    // Get products and settings
    const products = await Product.find({ organizationId: req.organizationId });
    let settings = await Settings.findOne({ organizationId: req.organizationId });

    // If no settings exist, use default threshold
    const defaultThreshold = 10;

    const lowStockItems = [];

    products.forEach((product) => {
      // Get threshold for this specific design
      let threshold = defaultThreshold;

      if (settings && settings.stockThresholds) {
        // Check if there's a design-specific override
        const override = settings.stockThresholds.designOverrides?.find(
          (item) => item.design === product.design
        );

        threshold = override
          ? override.threshold
          : settings.stockThresholds.globalThreshold || defaultThreshold;
      }

      // Check each color and size
      product.colors.forEach((color) => {
        color.sizes.forEach((size) => {
          // ✅ NEW LOGIC: Low stock if 0 < currentStock < threshold
          if (size.currentStock > 0 && size.currentStock < threshold) {
            lowStockItems.push({
              productId: product._id,
              design: product.design,
              color: color.color,
              size: size.size,
              currentStock: size.currentStock,
              threshold: threshold,
              status: 'low', // low stock
            });
          }
          // ✅ Also track out of stock items
          else if (size.currentStock === 0) {
            lowStockItems.push({
              productId: product._id,
              design: product.design,
              color: color.color,
              size: size.size,
              currentStock: 0,
              threshold: threshold,
              status: 'out', // out of stock
            });
          }
        });
      });
    });

    res.json(lowStockItems);
  } catch (error) {
    console.error('Get low stock items error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ NEW: Get stock status for all products with threshold info
// @desc Get all products with stock status (in stock, low, out)
// @route GET /api/inventory/stock-status
// @access Private
const getStockStatus = async (req, res) => {
  try {
    const products = await Product.find({ organizationId: req.organizationId });
    let settings = await Settings.findOne({ organizationId: req.organizationId });

    const defaultThreshold = 10;

    const stockStatus = products.map((product) => {
      // Get threshold for this design
      let threshold = defaultThreshold;

      if (settings && settings.stockThresholds) {
        const override = settings.stockThresholds.designOverrides?.find(
          (item) => item.design === product.design
        );

        threshold = override
          ? override.threshold
          : settings.stockThresholds.globalThreshold || defaultThreshold;
      }

      // Calculate totals and status for each color-size
      const colorSizeStatus = [];
      let totalStock = 0;
      let hasLowStock = false;
      let hasOutOfStock = false;

      product.colors.forEach((color) => {
        color.sizes.forEach((size) => {
          totalStock += size.currentStock;

          let status = 'in_stock';
          if (size.currentStock === 0) {
            status = 'out_of_stock';
            hasOutOfStock = true;
          } else if (size.currentStock < threshold) {
            status = 'low_stock';
            hasLowStock = true;
          }

          colorSizeStatus.push({
            color: color.color,
            size: size.size,
            currentStock: size.currentStock,
            status: status,
          });
        });
      });

      // Overall product status
      let overallStatus = 'in_stock';
      if (totalStock === 0) {
        overallStatus = 'out_of_stock';
      } else if (hasLowStock || hasOutOfStock) {
        overallStatus = 'low_stock';
      }

      return {
        productId: product._id,
        design: product.design,
        threshold: threshold,
        totalStock: totalStock,
        overallStatus: overallStatus,
        colorSizeDetails: colorSizeStatus,
      };
    });

    res.json(stockStatus);
  } catch (error) {
    console.error('Get stock status error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Update stock
// @route PUT /api/inventory/:id/stock
// @access Private
const updateStock = async (req, res) => {
  try {
    const { color, size, quantity, operation } = req.body;

    const product = await Product.findOne({
      _id: req.params.id,
      organizationId: req.organizationId,
    });

    if (product) {
      const colorIndex = product.colors.findIndex((c) => c.color === color);

      if (colorIndex === -1) {
        return res.status(404).json({ message: 'Color not found' });
      }

      const sizeIndex = product.colors[colorIndex].sizes.findIndex((s) => s.size === size);

      if (sizeIndex === -1) {
        return res.status(404).json({ message: 'Size not found' });
      }

      if (operation === 'add') {
        product.colors[colorIndex].sizes[sizeIndex].currentStock += quantity;
      } else if (operation === 'subtract') {
        product.colors[colorIndex].sizes[sizeIndex].currentStock -= quantity;
      } else {
        product.colors[colorIndex].sizes[sizeIndex].currentStock = quantity;
      }

      const updatedProduct = await product.save();
      await decrementEditSession(req, 'edit', 'inventory', req.params.id);
      res.json(updatedProduct);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ NEW: Reduce locked stock for specific variants
const reduceVariantLock = async (req, res) => {
  if (shouldUseLockStock() === false) {
    return res.json({ success: true, message: "Stock lock feature is disabled", results: [] });
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { items } = req.body; // Array of { design, color, size, reduceBy }
    const organizationId = req.organizationId;

    if (!items || items.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Items array is required',
      });
    }

    const results = [];

    for (const item of items) {
      const { design, color, size, reduceBy } = item;

      if (!design || !color || !size || !reduceBy || reduceBy <= 0) {
        continue; // Skip invalid items
      }

      // Find product
      const product = await Product.findOne({
        design,
        organizationId,
      }).session(session);

      if (!product) {
        continue; // Skip if product not found
      }

      // Find color variant
      const colorVariant = product.colors.find((c) => c.color === color);
      if (!colorVariant) {
        continue; // Skip if color not found
      }

      // Find size
      const sizeIndex = colorVariant.sizes.findIndex((s) => s.size === size);
      if (sizeIndex === -1) {
        continue; // Skip if size not found
      }

      const sizeVariant = colorVariant.sizes[sizeIndex];
      const currentLocked = sizeVariant.lockedStock || 0;
      const newLocked = Math.max(0, currentLocked - reduceBy);
      const actualReduction = currentLocked - newLocked;

      // Update locked stock
      sizeVariant.lockedStock = newLocked;
      await product.save({ session });

      results.push({
        design,
        color,
        size,
        previousLocked: currentLocked,
        newLocked,
        reduced: actualReduction,
      });

      console.log('✅ Variant lock reduced:', {
        design,
        color,
        size,
        previousLocked: currentLocked,
        newLocked,
        reduced: actualReduction,
      });
    }

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Variant locks reduced successfully',
      results,
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Reduce variant lock error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reduce variant locks',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// ✅ NEW: Refill locked stock for specific variants
const refillVariantLock = async (req, res) => {
  if (shouldUseLockStock() === false) {
    return res.json({ success: true, message: "Stock lock feature is disabled", results: [] });
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { items } = req.body; // Array of { design, color, size, refillBy }
    const organizationId = req.organizationId;

    console.log('🔓 Refill variant lock request:', {
      organizationId,
      itemsCount: items?.length
    });

    if (!items || items.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Items array is required',
      });
    }

    const results = [];

    for (const item of items) {
      const { design, color, size, refillBy } = item;

      if (!design || !color || !size || !refillBy || refillBy <= 0) {
        console.log('⚠️  Skipping invalid item:', item);
        continue;
      }

      // Find product
      const product = await Product.findOne({
        design,
        organizationId,
      }).session(session);

      if (!product) {
        console.log('⚠️  Product not found:', design);
        continue;
      }

      // Find color variant
      const colorVariant = product.colors.find((c) => c.color === color);
      if (!colorVariant) {
        console.log('⚠️  Color not found:', color);
        continue;
      }

      // Find size
      const sizeIndex = colorVariant.sizes.findIndex((s) => s.size === size);
      if (sizeIndex === -1) {
        console.log('⚠️  Size not found:', size);
        continue;
      }

      const sizeVariant = colorVariant.sizes[sizeIndex];
      const currentLocked = sizeVariant.lockedStock || 0;
      const newLocked = currentLocked + refillBy;

      // Update locked stock
      sizeVariant.lockedStock = newLocked;
      await product.save({ session });

      results.push({
        design,
        color,
        size,
        previousLocked: currentLocked,
        newLocked,
        refilled: refillBy,
      });

      console.log('✅ Variant lock refilled:', {
        design,
        color,
        size,
        previousLocked: currentLocked,
        newLocked,
        refilled: refillBy,
      });
    }

    await session.commitTransaction();

    console.log('✅ All variant locks refilled successfully:', results);

    res.json({
      success: true,
      message: 'Variant locks refilled successfully',
      results,
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('❌ Refill variant lock error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refill variant locks',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

const allocateReservedStock = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id: productId } = req.params;
    const { allocations } = req.body;
    const organizationId = req.organizationId;  // consistent with all other functions
    const userId = req.user.id;
    const product = await Product.findOne({ _id: productId, organizationId }).session(session);

    if (!product) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    const allocationChanges = []; // Track changes for logging

    for (const allocation of allocations) {
      const { color, size, accounts } = allocation;

      const colorVariant = product.colors.find(c => c.color === color);
      if (!colorVariant) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ 
          success: false, 
          message: `Color ${color} not found` 
        });
      }

      const sizeIndex = colorVariant.sizes.findIndex(s => s.size === size);
      if (sizeIndex === -1) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ 
          success: false, 
          message: `Size ${size} not found for color ${color}` 
        });
      }

      const sizeVariant = colorVariant.sizes[sizeIndex];

      const totalAllocated = accounts.reduce((sum, acc) => sum + acc.quantity, 0);

      if (totalAllocated > sizeVariant.reservedStock) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ 
          success: false, 
          message: `Allocation exceeds reserved stock for ${color}-${size}. Reserved: ${sizeVariant.reservedStock}, Trying to allocate: ${totalAllocated}` 
        });
      }

      // ✅ Process each account and track changes
      accounts.forEach(acc => {
        if (acc.quantity > 0) {
          const existingAlloc = sizeVariant.reservedAllocations?.find(
            a => a.accountName === acc.accountName
          );

          const quantityBefore = existingAlloc?.quantity || 0;
          const quantityAfter = acc.quantity;
          const amountChanged = quantityAfter - quantityBefore;

          if (amountChanged !== 0) {
            // Log the change
            allocationChanges.push({
              productId: product._id,
              design: product.design,
              color: color,
              size: size,
              accountName: acc.accountName,
              quantityBefore: quantityBefore,
              quantityAfter: quantityAfter,
              amountChanged: amountChanged,
              changeType: 'manualallocation',
              changedBy: userId,
              notes: amountChanged > 0 
                ? `Added ${amountChanged} units to ${acc.accountName}`
                : `Removed ${Math.abs(amountChanged)} units from ${acc.accountName}`,
              organizationId: organizationId
            });
          }

          if (existingAlloc) {
            existingAlloc.quantity = quantityAfter;
            existingAlloc.updatedAt = acc.updatedAt || new Date();
          } else {
            if (!sizeVariant.reservedAllocations) {
              sizeVariant.reservedAllocations = [];
            }
            sizeVariant.reservedAllocations.push({
              accountName: acc.accountName,
              quantity: quantityAfter,
              allocatedAt: acc.allocatedAt || new Date(),
              updatedAt: acc.updatedAt || new Date()
            });
          }
        }
      });

      // Remove allocations with 0 quantity
      const accountNamesInRequest = accounts.map(a => a.accountName);
      sizeVariant.reservedAllocations = sizeVariant.reservedAllocations.filter(
        alloc => accountNamesInRequest.includes(alloc.accountName) && 
                 accounts.find(a => a.accountName === alloc.accountName)?.quantity > 0
      );
    }

    product.markModified('colors');
    await product.save({ session });

    // ✅ Bulk insert allocation change logs
    if (allocationChanges.length > 0) {
      await AllocationChange.insertMany(allocationChanges, { session });
      logger.info('Allocation changes logged', { count: allocationChanges.length });
    }

    await session.commitTransaction();
    session.endSession();

    logger.info('Stock allocated successfully', {
      productId,
      design: product.design,
      allocations: allocations.length,
      changesLogged: allocationChanges.length
    });

    res.json({ 
      success: true, 
      message: 'Stock allocated successfully',
      data: product 
    });

  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    
    logger.error('Allocation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to allocate stock',
      error: error.message 
    });
  }
};

// ✅ NEW: Get Reserved Stock with Account Filter
const getReservedStockByAccount = async (req, res) => {
  try {
    const organizationId = req.organizationId;
    const { accountName } = req.query; // Optional: filter by account

    const products = await Product.find({ organizationId }).lean();

    // Transform data to show account-specific allocations
    const result = products.map(product => {
      const colors = product.colors.map(color => {
        const sizes = color.sizes.map(size => {
          // If account filter is specified, show only that account's stock
          if (accountName && accountName !== 'all') {
            const allocation = size.reservedAllocations?.find(
              a => a.accountName === accountName
            );
            return {
              size: size.size,
              currentStock: size.currentStock,
              reservedStock: size.reservedStock, // Total
              allocatedStock: allocation?.quantity || 0, // This account
              pool: size.reservedStock - (size.reservedAllocations?.reduce((sum, a) => sum + a.quantity, 0) || 0),
              reservedAllocations: size.reservedAllocations || []
            };
          }

          // No filter: show all allocations
          return {
            size: size.size,
            currentStock: size.currentStock,
            reservedStock: size.reservedStock,
            pool: size.reservedStock - (size.reservedAllocations?.reduce((sum, a) => sum + a.quantity, 0) || 0),
            reservedAllocations: size.reservedAllocations || []
          };
        });

        return {
          color: color.color,
          wholesalePrice: color.wholesalePrice,
          retailPrice: color.retailPrice,
          sizes
        };
      });

      return {
        _id: product._id,
        design: product.design,
        colors
      };
    });

    res.json({ 
      success: true, 
      data: result,
      accountName: accountName || 'all'
    });

  } catch (error) {
    console.error('Get reserved stock error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch reserved stock', 
      error: error.message 
    });
  }
};

module.exports = {
  getAllProducts,
  createProduct,
  getProductById,
  updateProduct,
  deleteProduct,
  getLowStockItems,
  updateStock,
  getStockStatus,
  reduceVariantLock,
  refillVariantLock,
  allocateReservedStock,
  getReservedStockByAccount,
};
