const DirectSale = require('../models/DirectSale');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Settings = require('../models/Settings');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

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


// Get all direct sales
const getAllSales = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const sales = await DirectSale.find({ organizationId })
      .populate('customerId', 'name phone')
      .sort({ createdAt: -1 })
      .lean();

    res.json(sales);
  } catch (error) {
    logger.error('Failed to fetch direct sales', { error: error.message });
    res.status(500).json({
      code: 'FETCH_FAILED',
      message: 'Failed to fetch sales',
      error: error.message,
    });
  }
};

// Get single sale by ID
const getSaleById = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const sale = await DirectSale.findOne({ _id: id, organizationId }).populate('customerId', 'name phone email');

    if (!sale) {
      return res.status(404).json({
        code: 'SALE_NOT_FOUND',
        message: 'Sale not found',
      });
    }

    res.json(sale);
  } catch (error) {
    logger.error('Failed to fetch sale', { error: error.message, saleId: req.params.id });
    res.status(500).json({
      code: 'FETCH_FAILED',
      message: 'Failed to fetch sale',
      error: error.message,
    });
  }
};

// 🔒 UPDATED: Create sale with STOCK LOCK validation and override option
const createSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { customerName, customerContact, items, subtotalAmount, discountAmount, gstAmount, totalAmount, paymentMethod, notes } = req.body;
    const organizationId = req.user.organizationId;

    // Validation
    if (!items || items.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        code: 'INVALID_DATA',
        message: 'Items are required',
      });
    }

    // 🔒 Fetch stock lock settings
    const settings = await Settings.findOne({ organizationId });
    const stockLockEnabled = settings?.stockLockEnabled || false;
    const stockLockValue = settings?.stockLockValue || 0;

    // ✅ DEBUG LOG 1: Settings
    console.log('🔒 Stock Lock Settings:', {
      stockLockEnabled,
      stockLockValue,
      organizationId
    });

    // ✅ FIXED: Find or create customer AND update stats
    let customer = null;
    if (customerContact) {
      customer = await Customer.findOne({
        mobile: customerContact,
        organizationId,
      }).session(session);

      if (!customer) {
        // Create new customer
        customer = await Customer.create([{
          name: customerName || 'Walk-in Customer',
          mobile: customerContact,
          organizationId,
          totalPurchases: 1, // ✅ Initialize with 1
          totalSpent: totalAmount, // ✅ Initialize with sale amount
          firstPurchaseDate: new Date(),
          lastPurchaseDate: new Date(),
        }], { session });
        customer = customer[0];
        logger.info('New customer created', { customerId: customer._id, name: customerName });
      } else {
        // ✅ Update existing customer stats
        customer.totalPurchases = (customer.totalPurchases || 0) + 1;
        customer.totalSpent = (customer.totalSpent || 0) + totalAmount;
        customer.lastPurchaseDate = new Date();

        // Set first purchase date if not set
        if (!customer.firstPurchaseDate) {
          customer.firstPurchaseDate = new Date();
        }

        await customer.save({ session });
        logger.info('Customer stats updated', {
          customerId: customer._id,
          totalPurchases: customer.totalPurchases,
          totalSpent: customer.totalSpent
        });
      }
    }

    // 🔒 Track items that need locked stock
    const insufficientStockItems = [];

    // ✅ Update inventory with validation
    for (const item of items) {
      const product = await Product.findOne({
        design: item.design,
        organizationId,
      }).session(session);

      if (!product) {
        await session.abortTransaction();
        return res.status(404).json({
          code: 'PRODUCT_NOT_FOUND',
          message: `Product not found: ${item.design}`,
        });
      }

      // Find color variant
      const colorVariant = product.colors.find((c) => c.color === item.color);
      if (!colorVariant) {
        await session.abortTransaction();
        return res.status(404).json({
          code: 'PRODUCT_NOT_FOUND',
          message: `Color ${item.color} not found for ${item.design}`,
        });
      }

      // Find size in color variant
      const sizeIndex = colorVariant.sizes.findIndex((s) => s.size === item.size);
      if (sizeIndex === -1) {
        await session.abortTransaction();
        return res.status(404).json({
          code: 'PRODUCT_NOT_FOUND',
          message: `Size ${item.size} not found for ${item.design} ${item.color}`,
        });
      }

      const currentStock = colorVariant.sizes[sizeIndex].currentStock;
      const lockedStock = colorVariant.sizes[sizeIndex].lockedStock || 0;  // ✅ Use variant lock
      const availableStock = Math.max(0, currentStock - lockedStock);

      // ✅ DEBUG LOG
      console.log('🔍 Stock Check:', {
        design: item.design,
        color: item.color,
        size: item.size,
        requestedQty: item.quantity,
        currentStock,
        lockedStock,
        availableStock,
        willNeedLock: item.quantity > availableStock
      });

      // 🔒 CHECK 1: Not enough even with locked stock
      if (currentStock < item.quantity) {
        await session.abortTransaction();
        return res.status(400).json({
          code: 'INSUFFICIENT_STOCK',
          message: `Insufficient stock for ${item.design} ${item.color} ${item.size}. Available: ${currentStock}, Requested: ${item.quantity}`,
          product: {
            design: item.design,
            color: item.color,
            size: item.size,
            available: currentStock,
            requested: item.quantity,
          },
        });
      }

      // 🔒 CHECK 2: Not enough available stock, but enough if we use locked stock
      if (item.quantity > availableStock) {
        const neededFromLock = item.quantity - availableStock;

        console.log('⚠️  Insufficient Available Stock!', {
          design: item.design,
          color: item.color,
          size: item.size,
          requested: item.quantity,
          available: availableStock,
          locked: lockedStock,
          neededFromLock
        });

        insufficientStockItems.push({
          design: item.design,
          color: item.color,
          size: item.size,
          requestedQty: item.quantity,
          availableStock,
          currentStock,
          lockedStock,
          neededFromLock,
        });
      }
    }

    // 🔒 IF STOCK LOCK OVERRIDE IS NEEDED
    if (insufficientStockItems.length > 0) {
      await session.abortTransaction();

      // Calculate total units needed from lock
      const totalNeededFromLock = insufficientStockItems.reduce((sum, item) => sum + item.neededFromLock, 0);

      console.log('🚫 STOPPING ORDER - Returning error with lock data:', {
        insufficientItemsCount: insufficientStockItems.length,
        totalNeededFromLock,
        insufficientItems: insufficientStockItems
      });

      return res.status(400).json({
        success: false,
        code: 'INSUFFICIENT_AVAILABLE_STOCK',
        message: 'Insufficient available stock. Locked stock usage required.',
        canUseLockedStock: true,
        insufficientItems: insufficientStockItems,
        totalNeededFromLock,
      });
    }

    console.log('✅ Stock validation passed - proceeding to deduct stock');

    // ✅ Stock validation passed - proceed to deduct stock
    for (const item of items) {
      const product = await Product.findOne({
        design: item.design,
        organizationId,
      }).session(session);

      const colorVariant = product.colors.find((c) => c.color === item.color);
      const sizeIndex = colorVariant.sizes.findIndex((s) => s.size === item.size);

      // Deduct stock
      colorVariant.sizes[sizeIndex].currentStock -= item.quantity;
      await product.save({ session });

      logger.debug('Stock updated for direct sale', {
        productId: product._id,
        design: item.design,
        color: item.color,
        size: item.size,
        newStock: colorVariant.sizes[sizeIndex].currentStock,
      });
    }

    // ✅ FIXED: Create sale with correct field names
    const sale = await DirectSale.create([{
      customerName: customerName || 'Walk-in Customer',
      customerMobile: customerContact || '', // ✅ Changed from customerContact
      customerId: customer?._id,
      items, // ✅ Array of items
      subtotalAmount,
      discountAmount: discountAmount || 0,
      gstAmount: gstAmount || 0,
      totalAmount,
      paymentMethod: paymentMethod || 'Cash',
      notes: notes || '',
      organizationId,
      createdBy: req.user._id,
      saleDate: new Date(),
    }], { session });

    await session.commitTransaction();
    logger.info('Direct sale created', { saleId: sale[0]._id, totalAmount });

    // ✅ DEBUG LOG 6: Sale created successfully
    console.log('✅ Sale created successfully:', {
      saleId: sale[0]._id,
      totalAmount
    });

    res.status(201).json(sale[0]);

  } catch (error) {
    await session.abortTransaction();
    logger.error('Direct sale creation failed', {
      error: error.message,
      stack: error.stack,
    });

    // ✅ DEBUG LOG 7: Error occurred
    console.error('❌ Sale creation error:', error);

    res.status(500).json({
      code: 'SALE_CREATION_FAILED',
      message: 'Failed to create sale',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Update sale
const updateSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const existingSale = await DirectSale.findOne({
      _id: id,
      organizationId,
    }).session(session);

    if (!existingSale) {
      await session.abortTransaction();
      return res.status(404).json({
        code: 'SALE_NOT_FOUND',
        message: 'Sale not found',
      });
    }

    // Restore old stock first
    for (const oldItem of existingSale.items) {
      const product = await Product.findOne({
        design: oldItem.design,
        organizationId,
      }).session(session);

      if (product) {
        const colorVariant = product.colors.find((c) => c.color === oldItem.color);
        if (colorVariant) {
          const sizeIndex = colorVariant.sizes.findIndex((s) => s.size === oldItem.size);
          if (sizeIndex !== -1) {
            colorVariant.sizes[sizeIndex].currentStock += oldItem.quantity;
            await product.save({ session });
          }
        }
      }
    }

    // Deduct new stock
    for (const newItem of req.body.items) {
      const product = await Product.findOne({
        design: newItem.design,
        organizationId,
      }).session(session);

      if (!product) {
        await session.abortTransaction();
        return res.status(404).json({
          code: 'PRODUCT_NOT_FOUND',
          message: `Product not found: ${newItem.design}`,
        });
      }

      const colorVariant = product.colors.find((c) => c.color === newItem.color);

      if (!colorVariant) {
        await session.abortTransaction();
        return res.status(404).json({
          code: 'PRODUCT_NOT_FOUND',
          message: `Color ${newItem.color} not found for ${newItem.design}`,
        });
      }

      const sizeIndex = colorVariant.sizes.findIndex((s) => s.size === newItem.size);

      if (sizeIndex === -1) {
        await session.abortTransaction();
        return res.status(404).json({
          code: 'PRODUCT_NOT_FOUND',
          message: `Size ${newItem.size} not found for ${newItem.design} ${newItem.color}`,
        });
      }

      const currentStock = colorVariant.sizes[sizeIndex].currentStock;

      if (currentStock < newItem.quantity) {
        await session.abortTransaction();
        return res.status(400).json({
          code: 'INSUFFICIENT_STOCK',
          message: `Insufficient stock for ${newItem.design} ${newItem.color} ${newItem.size}. Available: ${currentStock}, Requested: ${newItem.quantity}`,
        });
      }

      colorVariant.sizes[sizeIndex].currentStock -= newItem.quantity;
      await product.save({ session });
    }

    // Update sale
    Object.assign(existingSale, req.body);
    await existingSale.save({ session });

    await session.commitTransaction();
    await decrementEditSession(req, 'edit', 'directSales', req.params.id);

    logger.info('Direct sale updated', { saleId: id });

    res.json(existingSale);
  } catch (error) {
    await session.abortTransaction();
    logger.error('Sale update failed', { error: error.message, saleId: req.params.id });
    res.status(500).json({
      code: 'UPDATE_FAILED',
      message: 'Failed to update sale',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Delete sale
const deleteSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const sale = await DirectSale.findOne({ _id: id, organizationId }).session(session);

    if (!sale) {
      await session.abortTransaction();
      return res.status(404).json({
        code: 'SALE_NOT_FOUND',
        message: 'Sale not found',
      });
    }

    // Restore stock
    for (const item of sale.items) {
      const product = await Product.findOne({
        design: item.design,
        organizationId,
      }).session(session);

      if (product) {
        const colorVariant = product.colors.find((c) => c.color === item.color);
        if (colorVariant) {
          const sizeIndex = colorVariant.sizes.findIndex((s) => s.size === item.size);
          if (sizeIndex !== -1) {
            colorVariant.sizes[sizeIndex].currentStock += item.quantity;
            await product.save({ session });
          }
        }
      }
    }
    // ✅ Update customer stats on delete
    if (sale.customerId) {
      const customer = await Customer.findById(sale.customerId).session(session);
      if (customer) {
        customer.totalPurchases = Math.max(0, (customer.totalPurchases || 0) - 1);
        customer.totalSpent = Math.max(0, (customer.totalSpent || 0) - sale.totalAmount);
        
        // If no more purchases, clear lastPurchaseDate
        if (customer.totalPurchases === 0) {
          customer.lastPurchaseDate = null;
        }
        
        await customer.save({ session });
        logger.info('Customer stats updated after sale deletion', {
          customerId: customer._id,
          totalPurchases: customer.totalPurchases,
          totalSpent: customer.totalSpent
        });
      }
    }

    await DirectSale.findByIdAndDelete(id).session(session);

    await session.commitTransaction();
    await decrementEditSession(req, 'edit', 'directSales', req.params.id);

    logger.info('Direct sale deleted', { saleId: id });

    res.json({ message: 'Sale deleted successfully' });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Sale deletion failed', { error: error.message, saleId: req.params.id });
    res.status(500).json({
      code: 'DELETE_FAILED',
      message: 'Failed to delete sale',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Get sales by date range
const getSalesByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const organizationId = req.user.organizationId;

    const query = { organizationId };

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const sales = await DirectSale.find(query).populate('customerId', 'name phone').sort({ createdAt: -1 }).lean();

    res.json(sales);
  } catch (error) {
    logger.error('Failed to fetch sales by date range', { error: error.message });
    res.status(500).json({
      code: 'FETCH_FAILED',
      message: 'Failed to fetch sales',
      error: error.message,
    });
  }
};

// Get sales by customer
const getSalesByCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    const organizationId = req.user.organizationId;

    const sales = await DirectSale.find({
      customerId,
      organizationId,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json(sales);
  } catch (error) {
    logger.error('Failed to fetch sales by customer', { error: error.message, customerId: req.params.customerId });
    res.status(500).json({
      code: 'FETCH_FAILED',
      message: 'Failed to fetch sales',
      error: error.message,
    });
  }
};

// ✅ Get all customers
const getAllCustomers = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    
    const customers = await Customer.find({ organizationId })
      .sort({ lastPurchaseDate: -1 })
      .lean();

    res.json(customers);
  } catch (error) {
    logger.error('Failed to fetch customers', { error: error.message });
    res.status(500).json({
      code: 'FETCH_FAILED',
      message: 'Failed to fetch customers',
      error: error.message,
    });
  }
};

// ✅ Get customer by mobile
const getCustomerByMobile = async (req, res) => {
  try {
    const { mobile } = req.params;
    const organizationId = req.user.organizationId;

    const customer = await Customer.findOne({ mobile, organizationId }).lean();

    if (!customer) {
      return res.status(404).json({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Customer not found',
      });
    }

    res.json(customer);
  } catch (error) {
    logger.error('Failed to fetch customer by mobile', { 
      error: error.message, 
      mobile: req.params.mobile 
    });
    res.status(500).json({
      code: 'FETCH_FAILED',
      message: 'Failed to fetch customer',
      error: error.message,
    });
  }
};

// ✅ Update module.exports
module.exports = {
  getAllSales,
  getSaleById,
  createSale,
  updateSale,
  deleteSale,
  getSalesByDateRange,
  getSalesByCustomer,
  getAllCustomers,        // ✅ ADD THIS
  getCustomerByMobile,    // ✅ ADD THIS
};
