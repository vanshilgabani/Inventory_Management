const WholesaleOrder = require('../models/WholesaleOrder');
const WholesaleBuyer = require('../models/WholesaleBuyer');
const Product = require('../models/Product');
const Settings = require('../models/Settings');
const Transfer = require('../models/Transfer');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { checkBuyerNotifications } = require('../utils/checkNotifications');
const { generateChallanPDF } = require('../utils/pdfGenerator');
const { sendWholesaleChallan } = require('../utils/emailService');

// ✅ ADD THIS - Global flag to disable locked stock
const STOCK_LOCK_DISABLED = true;

// Helper to check if we should use locked stock
const shouldUseLockStock = () => {
  if (STOCK_LOCK_DISABLED) return false; // Force disable
  return false; // Always disabled
};

// Get all wholesale orders
const getAllOrders = async (req, res) => {
  try {
    const { organizationId } = req.user;

    const orders = await WholesaleOrder.find({ organizationId })
      .populate('buyerId', 'name mobile businessName')
      .sort({ createdAt: -1 })
      .lean();

    res.json(orders);
  } catch (error) {
    logger.error('Failed to fetch orders', { error: error.message });
    res.status(500).json({ code: 'FETCH_FAILED', message: 'Failed to fetch orders', error: error.message });
  }
};

// Get single order by ID
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;

    const order = await WholesaleOrder.findOne({ _id: id, organizationId })
      .populate('buyerId', 'name mobile businessName email address');

    if (!order) {
      return res.status(404).json({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    logger.error('Failed to fetch order', { error: error.message, orderId: req.params.id });
    res.status(500).json({ code: 'FETCH_FAILED', message: 'Failed to fetch order', error: error.message });
  }
};

// 🔒 UPDATED: Create Order with STOCK LOCK validation and override option
const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      buyerName,
      buyerContact,
      buyerEmail,
      buyerAddress,
      businessName,
      gstNumber,
      deliveryDate,
      items,
      subtotalAmount,
      discountType,
      discountValue,
      discountAmount,
      gstEnabled,
      gstAmount,
      cgst,
      sgst,
      totalAmount,
      amountPaid,
      paymentMethod,
      notes,
      fulfillmentType,
    } = req.body;

    const { organizationId } = req.user;

    // Validation
    if (!buyerContact || !items || items.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ code: 'INVALID_DATA', message: 'Buyer contact and items are required' });
    }

    // 🔒 Fetch stock lock settings
    const settings = await Settings.findOne({ organizationId });
    const stockLockEnabled = settings?.stockLockEnabled || false;
    const stockLockValue = settings?.stockLockValue || 0;

    // Check for duplicate orders within last 1 minute
    const recentOrder = await WholesaleOrder.findOne({
      buyerContact,
      organizationId,
      createdAt: { $gte: new Date(Date.now() - 60000) },
      totalAmount,
    }).session(session);

    if (recentOrder) {
      await session.abortTransaction();
      return res.status(400).json({ code: 'DUPLICATE_ORDER', message: 'Duplicate order detected. Please wait before creating another order.' });
    }

    // Find or create buyer
    let buyer = await WholesaleBuyer.findOne({ mobile: buyerContact, organizationId }).session(session);

    if (!buyer) {
      buyer = await WholesaleBuyer.create(
        [
          {
            name: buyerName,
            mobile: buyerContact,
            email: buyerEmail || '',
            address: buyerAddress || '',
            businessName: businessName || buyerName,
            gstNumber: gstNumber || '',
            organizationId,
            creditLimit: 0,
            totalDue: 0,
            isTrusted: false,
          },
        ],
        { session }
      );
      buyer = buyer[0];
      logger.info('New buyer created', { buyerId: buyer._id, name: buyerName });
    }

    // ✅ UPDATED: Skip stock validation for factory_direct orders
    if (fulfillmentType !== 'factory_direct') {
      // 🔒 Track items that need locked stock
      const insufficientStockItems = [];

      // ✅ Update inventory with validation (only for warehouse orders)
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
        const lockedStock = shouldUseLockStock() ? (colorVariant.sizes[sizeIndex].lockedStock || 0) : 0;
        const availableStock = Math.max(0, currentStock - lockedStock);

        // ✅ DEBUG LOG
        console.log('🔍 Stock Check (Wholesale):', {
          design: item.design,
          color: item.color,
          size: item.size,
          requestedQty: item.quantity,
          currentStock,
          lockedStock,
          availableStock,
          willNeedLock: item.quantity > availableStock
        });

        const reservedStock = colorVariant.sizes[sizeIndex].reservedStock || 0;

        // 🔒 CHECK 1: Not enough even with locked stock
        if (currentStock + reservedStock < item.quantity) {
          await session.abortTransaction();
          return res.status(400).json({
            code: 'INSUFFICIENT_STOCK',
            message: `Insufficient stock for ${item.design} ${item.color} ${item.size}. Total Available: ${currentStock + reservedStock}, Requested: ${item.quantity}`,
            product: {
              design: item.design,
              color: item.color,
              mainStock: currentStock,
              reservedStock: reservedStock,
              totalAvailable: currentStock + reservedStock,
              requested: item.quantity,
            },
          });
        }

        // 🔒 CHECK 2: Not enough available stock, but enough if we use locked stock
        if (item.quantity > currentStock) {
          const neededFromReserved = item.quantity - currentStock;

          console.log('⚠️  Insufficient Available Stock (Wholesale)!', {
            design: item.design,
            color: item.color,
            size: item.size,
            requested: item.quantity,
            mainStock: currentStock,
            reservedStock: reservedStock,
            neededFromReserved
          });

          insufficientStockItems.push({
            design: item.design,
            color: item.color,
            size: item.size,
            requestedQty: item.quantity,
            mainStock: currentStock,
            reservedStock: reservedStock,
            neededFromReserved,
          });
        }
      }

      // ✅ NEW: IF NEED TO BORROW FROM RESERVED
      if (insufficientStockItems.length > 0) {
        await session.abortTransaction();
        const totalNeededFromReserved = insufficientStockItems.reduce((sum, item) => sum + item.neededFromReserved, 0);
        
        console.log('🚫 STOPPING ORDER (Wholesale) - Need Reserved Stock:', {
          insufficientItemsCount: insufficientStockItems.length,
          totalNeededFromReserved,
          insufficientItems: insufficientStockItems
        });

        return res.status(400).json({
          success: false,
          code: 'MAIN_INSUFFICIENT_BORROW_RESERVED',
          message: 'Main inventory insufficient. Reserved stock borrowing required.',
          canBorrowFromReserved: true,
          insufficientItems: insufficientStockItems,
          totalNeededFromReserved,
        });
      }

      console.log('✅ Stock validation passed (Wholesale) - proceeding to deduct stock');

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

        logger.debug('Stock updated', {
          productId: product._id,
          design: item.design,
          color: item.color,
          size: item.size,
          newStock: colorVariant.sizes[sizeIndex].currentStock,
        });
      }
    } else {
      logger.info('Factory direct order - skipping stock deduction', { organizationId });
    }

    // Generate challan number (thread-safe)
    const challanNumber = await generateChallanNumber(businessName || buyerName, buyerContact, organizationId, session);

    // Calculate amounts
    const amountDue = totalAmount - (amountPaid || 0);
    const paymentStatus = amountDue === 0 ? 'Paid' : amountPaid > 0 ? 'Partial' : 'Pending';

    // Create order
    const order = await WholesaleOrder.create(
      [
        {
          challanNumber,
          buyerId: buyer._id,
          buyerName,
          buyerContact,
          buyerEmail: buyerEmail || '',
          buyerAddress: buyerAddress || '',
          businessName: businessName || buyerName,
          gstNumber: gstNumber || '',
          deliveryDate: deliveryDate || null,
          items,
          subtotalAmount,
          discountType: discountType || 'none',
          discountValue: discountValue || 0,
          discountAmount: discountAmount || 0,
          gstEnabled: gstEnabled || false,
          gstAmount: gstAmount || 0,
          cgst: cgst || 0,
          sgst: sgst || 0,
          totalAmount,
          amountPaid: amountPaid || 0,
          amountDue,
          paymentStatus,
          paymentMethod: paymentMethod || 'Cash',
          orderStatus: 'Delivered',
          notes: notes || '',
          fulfillmentType: fulfillmentType || 'warehouse',
          organizationId,
          createdBy: req.user._id,
        },
      ],
      { session }
    );

    // Update buyer's total due
    buyer.totalDue = (buyer.totalDue || 0) + amountDue;
    buyer.totalOrders = (buyer.totalOrders || 0) + 1;
    buyer.lastOrderDate = new Date();
    await buyer.save({ session });

    await session.commitTransaction();

    logger.info('Order created successfully', {
      orderId: order[0]._id,
      challanNumber,
      totalAmount,
      fulfillmentType: fulfillmentType || 'warehouse',
    });

    // ✅ NEW: Check if auto-email is enabled (nested in notifications)
    try {
      const settings = await Settings.findOne({ organizationId });
      if (settings?.notifications?.autoEmailChallan && buyerEmail) {
        // Generate PDF asynchronously (don't block response)
        setImmediate(async () => {
          try {
            const challanSettings = {
              companyName: settings.companyName || 'VEERAA IMPEX',
              address: settings.address || 'Surat, Gujarat, India',
              email: settings.email || '',
              phone: settings.phone || '9824556000',
              gstNumber: settings.gstNumber || '',
              gstPercentage: settings.gstPercentage || 5,
            };

            const pdfBuffer = await generateChallanPDF(order[0].toObject(), challanSettings);

            await sendWholesaleChallan(
              buyerEmail,
              `Delivery Challan - ${challanNumber}`,
              `Dear ${buyerName},\n\nPlease find attached your delivery challan.\n\nThank you for your business!`,
              pdfBuffer,
              `Challan_${challanNumber}.pdf`
            );

            logger.info('Challan email sent successfully', {
              orderId: order[0]._id,
              challanNumber,
              buyerEmail,
            });
          } catch (emailError) {
            logger.error('Failed to send challan email', {
              error: emailError.message,
              orderId: order[0]._id,
              challanNumber,
            });
          }
        });
      }
    } catch (settingsError) {
      logger.warn('Failed to check auto-email setting', { error: settingsError.message });
    }

    // Check notifications
    try {
      await checkBuyerNotifications(buyer._id);
    } catch (notifError) {
      logger.error('Notification check failed', { error: notifError.message, buyerId: buyer._id });
    }

    res.status(201).json(order[0]);
  } catch (error) {
    await session.abortTransaction();
    logger.error('Order creation failed', { error: error.message, stack: error.stack });
    res.status(500).json({ code: 'ORDER_CREATION_FAILED', message: 'Failed to create order', error: error.message });
  } finally {
    session.endSession();
  }
};

// ✅ UPDATED: Per-buyer sequential challan number generation
const generateChallanNumber = async (businessName, buyerContact, organizationId, session) => {
  try {
    // Count orders for THIS specific buyer only
    const buyerOrderCount = await WholesaleOrder.countDocuments({
      buyerContact,
      organizationId,
    }).session(session);

    const orderNumber = buyerOrderCount + 1;

    // Clean business name:
    // 1. Remove all special characters except spaces
    // 2. Replace spaces with underscores
    // 3. Convert to uppercase
    const cleanBusinessName = businessName
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters, keep spaces
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .toUpperCase(); // Convert to uppercase

    // Format: BUSINESSNAME_ORDERNUMBER (e.g., RAM_001, RAM_002, etc.)
    const challanNumber = `${cleanBusinessName}_${String(orderNumber).padStart(2, '0')}`;

    logger.debug('Challan number generated', {
      businessName,
      cleanBusinessName,
      buyerContact,
      buyerOrderCount,
      orderNumber,
      challanNumber,
    });

    return challanNumber;
  } catch (error) {
    logger.error('Challan number generation failed', { error: error.message });
    // Fallback to timestamp-based if generation fails
    return `CH_${Date.now().toString().slice(-8)}`;
  }
};

// ✅ NEW: Manual send challan email endpoint
const sendChallanEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;

    const order = await WholesaleOrder.findOne({ _id: id, organizationId });

    if (!order) {
      return res.status(404).json({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    }

    if (!order.buyerEmail) {
      return res.status(400).json({ code: 'NO_EMAIL', message: 'Buyer email not available' });
    }

    const settings = await Settings.findOne({ organizationId });

    const challanSettings = {
      companyName: settings?.companyName || 'VEERAA IMPEX',
      address: settings?.address || 'Surat, Gujarat, India',
      email: settings?.email || '',
      phone: settings?.phone || '9824556000',
      gstNumber: settings?.gstNumber || '',
      gstPercentage: settings?.gstPercentage || 5,
    };

    const pdfBuffer = await generateChallanPDF(order.toObject(), challanSettings);

    await sendWholesaleChallan(
      order.buyerEmail,
      `Delivery Challan - ${order.challanNumber}`,
      `Dear ${order.buyerName},\n\nPlease find attached your delivery challan.\n\nThank you for your business!`,
      pdfBuffer,
      `Challan_${order.challanNumber}.pdf`
    );

    logger.info('Challan email sent manually', {
      orderId: order._id,
      challanNumber: order.challanNumber,
      buyerEmail: order.buyerEmail,
    });

    res.json({ message: 'Challan sent successfully via email' });
  } catch (error) {
    logger.error('Failed to send challan email', { error: error.message, orderId: req.params.id });
    res.status(500).json({ code: 'EMAIL_FAILED', message: 'Failed to send challan email', error: error.message });
  }
};

// ✅ PERMANENT FIX: Update order with smart stock validation
const updateOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const existingOrder = await WholesaleOrder.findOne({
      _id: id,
      organizationId,
    }).session(session);

    if (!existingOrder) {
      await session.abortTransaction();
      return res.status(404).json({
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found',
      });
    }

    // ✅ STEP 1: Build map of existing items (design-color-size -> quantity)
    const existingItemsMap = new Map();
    for (const oldItem of existingOrder.items) {
      const key = `${oldItem.design}-${oldItem.color}-${oldItem.size}`;
      existingItemsMap.set(key, oldItem.quantity);
    }

    const newFulfillmentType = req.body.fulfillmentType || existingOrder.fulfillmentType;

    // ✅ STEP 2: Validate stock ONLY for new items or quantity increases (warehouse only)
    if (newFulfillmentType === 'warehouse') {
      for (const newItem of req.body.items) {
        const key = `${newItem.design}-${newItem.color}-${newItem.size}`;
        const oldQuantity = existingItemsMap.get(key) || 0;
        const quantityDifference = newItem.quantity - oldQuantity;

        // Only validate if we need MORE stock than before
        if (quantityDifference > 0) {
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

          // ✅ KEY FIX: Only check if we have enough for the ADDITIONAL quantity needed
          if (currentStock < quantityDifference) {
            await session.abortTransaction();
            return res.status(400).json({
              code: 'INSUFFICIENT_STOCK',
              message: `Insufficient stock for ${newItem.design} ${newItem.color} ${newItem.size}. Available: ${currentStock}, Additional needed: ${quantityDifference}`,
              product: {
                design: newItem.design,
                color: newItem.color,
                size: newItem.size,
                available: currentStock,
                additionalNeeded: quantityDifference,
              },
            });
          }
        }
      }
    }

    // ✅ STEP 3: Restore old stock (if it was warehouse order)
    if (existingOrder.fulfillmentType === 'warehouse') {
      for (const oldItem of existingOrder.items) {
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
              logger.debug('Stock restored', {
                design: oldItem.design,
                color: oldItem.color,
                size: oldItem.size,
                restoredQty: oldItem.quantity,
              });
            }
          }
        }
      }
    }

    // ✅ STEP 4: Deduct new stock (if it's warehouse order)
    if (newFulfillmentType === 'warehouse') {
      for (const newItem of req.body.items) {
        const product = await Product.findOne({
          design: newItem.design,
          organizationId,
        }).session(session);

        if (product) {
          const colorVariant = product.colors.find((c) => c.color === newItem.color);
          if (colorVariant) {
            const sizeIndex = colorVariant.sizes.findIndex((s) => s.size === newItem.size);
            if (sizeIndex !== -1) {
              colorVariant.sizes[sizeIndex].currentStock -= newItem.quantity;
              await product.save({ session });
              logger.debug('Stock deducted', {
                design: newItem.design,
                color: newItem.color,
                size: newItem.size,
                deductedQty: newItem.quantity,
              });
            }
          }
        }
      }
    }

    // ✅ STEP 5: Update buyer's total due
    const buyer = await WholesaleBuyer.findById(existingOrder.buyerId).session(session);
    if (buyer) {
      buyer.totalDue = (buyer.totalDue || 0) - existingOrder.amountDue + (req.body.amountDue || 0);
      await buyer.save({ session });
    }

    // ✅ STEP 6: Update order
    Object.assign(existingOrder, req.body);
    await existingOrder.save({ session });

    await session.commitTransaction();

    logger.info('Order updated successfully', {
      orderId: id,
      fulfillmentType: newFulfillmentType,
      itemsCount: req.body.items.length,
    });

    res.json(existingOrder);
  } catch (error) {
    await session.abortTransaction();
    logger.error('Order update failed', { error: error.message, orderId: req.params.id });
    res.status(500).json({
      code: 'UPDATE_FAILED',
      message: 'Failed to update order',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Delete order
const deleteOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const order = await WholesaleOrder.findOne({ _id: id, organizationId }).session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found',
      });
    }

    // ✅ Restore stock ONLY for warehouse orders
    if (order.fulfillmentType === 'warehouse') {
      for (const item of order.items) {
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
    } else {
      logger.info('Factory direct order - skipping stock restoration', { orderId: id });
    }

    // Update buyer's total due
    const buyer = await WholesaleBuyer.findById(order.buyerId).session(session);
    if (buyer) {
      buyer.totalDue = Math.max(0, (buyer.totalDue || 0) - order.amountDue);
      buyer.totalOrders = Math.max(0, (buyer.totalOrders || 1) - 1);
      await buyer.save({ session });
    }

    await WholesaleOrder.findByIdAndDelete(id).session(session);

    await session.commitTransaction();

    logger.info('Order deleted successfully', { orderId: id, fulfillmentType: order.fulfillmentType });

    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Order deletion failed', { error: error.message, orderId: req.params.id });
    res.status(500).json({
      code: 'DELETE_FAILED',
      message: 'Failed to delete order',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Get pending payments
const getPendingPayments = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const orders = await WholesaleOrder.find({
      organizationId,
      amountDue: { $gt: 0 },
    })
      .populate('buyerId', 'name mobile businessName')
      .sort({ createdAt: -1 })
      .lean();

    res.json(orders);
  } catch (error) {
    logger.error('Failed to fetch pending payments', { error: error.message });
    res.status(500).json({
      code: 'FETCH_FAILED',
      message: 'Failed to fetch pending payments',
      error: error.message,
    });
  }
};

// ✅ UPDATED: Get all buyers with aggregated order totals
const getAllBuyers = async (req, res) => {
  try {
    const { organizationId } = req.user;

    const buyers = await WholesaleBuyer.aggregate([
      {
        $match: { organizationId: new mongoose.Types.ObjectId(organizationId) },
      },
      {
        $lookup: {
          from: 'wholesaleorders',
          let: { buyerMobile: '$mobile' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$buyerContact', '$$buyerMobile'] },
                    { $eq: ['$organizationId', new mongoose.Types.ObjectId(organizationId)] },
                  ],
                },
              },
            },
          ],
          as: 'orders',
        },
      },
      {
        $addFields: {
          totalOrders: { $size: '$orders' },
          totalSpent: { $sum: '$orders.totalAmount' },
          totalPaid: { $sum: '$orders.amountPaid' },
          totalDue: {
            $sum: {
              $map: {
                input: '$orders',
                as: 'order',
                in: { $subtract: ['$$order.totalAmount', '$$order.amountPaid'] },
              },
            },
          },
          lastOrderDate: { $max: '$orders.createdAt' },
        },
      },
      {
        $sort: { lastOrderDate: -1 },
      },
    ]);

    res.json(buyers);
  } catch (error) {
    logger.error('Failed to fetch buyers', { error: error.message });
    res.status(500).json({
      code: 'FETCH_FAILED',
      message: 'Failed to fetch buyers',
      error: error.message,
    });
  }
};

// Get buyer by mobile
const getBuyerByMobile = async (req, res) => {
  try {
    const { mobile } = req.params;
    const organizationId = req.user.organizationId;

    const buyer = await WholesaleBuyer.findOne({ mobile, organizationId });

    if (!buyer) {
      return res.status(404).json({
        code: 'BUYER_NOT_FOUND',
        message: 'Buyer not found',
      });
    }

    res.json(buyer);
  } catch (error) {
    logger.error('Failed to fetch buyer', { error: error.message, mobile: req.params.mobile });
    res.status(500).json({
      code: 'FETCH_FAILED',
      message: 'Failed to fetch buyer',
      error: error.message,
    });
  }
};

// Get buyer history
const getBuyerHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const orders = await WholesaleOrder.find({
      buyerId: id,
      organizationId,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json(orders);
  } catch (error) {
    logger.error('Failed to fetch buyer history', { error: error.message, buyerId: req.params.id });
    res.status(500).json({
      code: 'FETCH_FAILED',
      message: 'Failed to fetch buyer history',
      error: error.message,
    });
  }
};

// Update buyer credit
const updateBuyerCredit = async (req, res) => {
  try {
    const { id } = req.params;
    const { creditLimit } = req.body;
    const organizationId = req.user.organizationId;

    const buyer = await WholesaleBuyer.findOneAndUpdate(
      { _id: id, organizationId },
      { creditLimit },
      { new: true }
    );

    if (!buyer) {
      return res.status(404).json({
        code: 'BUYER_NOT_FOUND',
        message: 'Buyer not found',
      });
    }

    logger.info('Buyer credit updated', { buyerId: id, creditLimit });

    res.json(buyer);
  } catch (error) {
    logger.error('Failed to update buyer credit', { error: error.message, buyerId: req.params.id });
    res.status(500).json({
      code: 'UPDATE_FAILED',
      message: 'Failed to update buyer credit',
      error: error.message,
    });
  }
};

// Update buyer trust status
const updateBuyerTrust = async (req, res) => {
  try {
    const { id } = req.params;
    const { isTrusted } = req.body;
    const organizationId = req.user.organizationId;

    const buyer = await WholesaleBuyer.findOneAndUpdate(
      { _id: id, organizationId },
      { isTrusted },
      { new: true }
    );

    if (!buyer) {
      return res.status(404).json({
        code: 'BUYER_NOT_FOUND',
        message: 'Buyer not found',
      });
    }

    logger.info('Buyer trust status updated', { buyerId: id, isTrusted });

    res.json(buyer);
  } catch (error) {
    logger.error('Failed to update buyer trust', { error: error.message, buyerId: req.params.id });
    res.status(500).json({
      code: 'UPDATE_FAILED',
      message: 'Failed to update buyer trust',
      error: error.message,
    });
  }
};

// Update buyer email
const updateBuyerEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    const organizationId = req.user.organizationId;

    const buyer = await WholesaleBuyer.findOneAndUpdate(
      { _id: id, organizationId },
      { email },
      { new: true }
    );

    if (!buyer) {
      return res.status(404).json({
        code: 'BUYER_NOT_FOUND',
        message: 'Buyer not found',
      });
    }

    logger.info('Buyer email updated', { buyerId: id, email });

    res.json(buyer);
  } catch (error) {
    logger.error('Failed to update buyer email', { error: error.message, buyerId: req.params.id });
    res.status(500).json({
      code: 'UPDATE_FAILED',
      message: 'Failed to update buyer email',
      error: error.message,
    });
  }
};

// ✅ IMPROVED: Update payment history with notification trigger
const updatePaymentHistory = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { paymentHistory, amountPaid } = req.body;

    const order = await WholesaleOrder.findById(id).session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found',
      });
    }

    const buyer = await WholesaleBuyer.findById(order.buyerId).session(session);

    if (!buyer) {
      await session.abortTransaction();
      return res.status(404).json({
        code: 'BUYER_NOT_FOUND',
        message: 'Buyer not found',
      });
    }

    // Update order payment
    const oldAmountDue = order.amountDue;
    order.paymentHistory = paymentHistory;
    order.amountPaid = amountPaid;
    order.amountDue = Math.max(0, order.totalAmount - amountPaid);

    // Update payment status
    if (order.amountDue === 0) {
      order.paymentStatus = 'paid';
    } else if (order.amountPaid > 0) {
      order.paymentStatus = 'partial';
    }

    await order.save({ session });

    // Update buyer's total due
    buyer.totalDue = Math.max(0, (buyer.totalDue || 0) - (oldAmountDue - order.amountDue));
    await buyer.save({ session });

    await session.commitTransaction();

    logger.info('Payment history updated', { orderId: id });

    // ✅ CRITICAL: Check notifications after payment
    try {
      await checkBuyerNotifications(buyer._id);
    } catch (notifError) {
      logger.error('Notification check failed after payment', {
        error: notifError.message,
        buyerId: buyer._id,
      });
    }

    res.json(order);
  } catch (error) {
    await session.abortTransaction();
    logger.error('Payment history update failed', { error: error.message, orderId: req.params.id });
    res.status(500).json({
      code: 'UPDATE_FAILED',
      message: 'Failed to update payment history',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Send credit warning
const sendCreditWarning = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const buyer = await WholesaleBuyer.findOne({ _id: id, organizationId });

    if (!buyer) {
      return res.status(404).json({
        code: 'BUYER_NOT_FOUND',
        message: 'Buyer not found',
      });
    }

    // Trigger notification check
    await checkBuyerNotifications(buyer._id);

    logger.info('Credit warning sent', { buyerId: id });

    res.json({ message: 'Credit warning sent successfully' });
  } catch (error) {
    logger.error('Failed to send credit warning', { error: error.message, buyerId: req.params.id });
    res.status(500).json({
      code: 'SEND_FAILED',
      message: 'Failed to send credit warning',
      error: error.message,
    });
  }
};

// Preview challan number
const previewChallanNumber = async (req, res) => {
  try {
    const { businessName, buyerContact } = req.body;
    const organizationId = req.user.organizationId;

    const buyer = await WholesaleBuyer.findOne({ mobile: buyerContact, organizationId });

    let nextNumber;
    if (buyer && buyer.challanCounter) {
      nextNumber = buyer.challanCounter + 1;
    } else {
      const count = await WholesaleOrder.countDocuments({ buyerContact, organizationId });
      nextNumber = count + 1;
    }

    const businessCode = businessName.substring(0, 3).toUpperCase();
    const buyerCode = buyerContact.slice(-4);
    const challanNumber = `${businessCode}${buyerCode}${String(nextNumber).padStart(3, '0')}`;

    res.json({ challanNumber });
  } catch (error) {
    logger.error('Failed to preview challan number', { error: error.message });
    res.status(500).json({
      code: 'PREVIEW_FAILED',
      message: 'Failed to preview challan number',
      error: error.message,
    });
  }
};

// ============================================
// BULK PAYMENT FUNCTIONS
// ============================================

// Record bulk payment with cascading allocation
const recordBulkPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params; // buyer ID
    const { amount, paymentMethod, paymentDate, notes } = req.body;
    const organizationId = req.user.organizationId;

    // Validation
    if (!amount || amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        code: 'INVALID_AMOUNT',
        message: 'Payment amount must be greater than 0',
      });
    }

    // Find buyer
    const buyer = await WholesaleBuyer.findOne({
      _id: id,
      organizationId,
    }).session(session);

    if (!buyer) {
      await session.abortTransaction();
      return res.status(404).json({
        code: 'BUYER_NOT_FOUND',
        message: 'Buyer not found',
      });
    }

    // Get all pending orders for this buyer (oldest first - FIFO)
    const pendingOrders = await WholesaleOrder.find({
      buyerId: buyer._id,
      organizationId,
      amountDue: { $gt: 0 },
    })
      .sort({ orderDate: 1 }) // Oldest first
      .session(session);

    if (pendingOrders.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        code: 'NO_PENDING_ORDERS',
        message: 'No pending orders found for this buyer',
      });
    }

    // Cascade payment allocation
    let remainingAmount = amount;
    const ordersAffected = [];

    for (const order of pendingOrders) {
      if (remainingAmount <= 0) break;

      const previousDue = order.amountDue;
      const amountToAllocate = Math.min(remainingAmount, order.amountDue);

      // Update order
      order.amountPaid += amountToAllocate;
      order.amountDue -= amountToAllocate;

      // Add payment to order's payment history
      order.paymentHistory.push({
        amount: amountToAllocate,
        paymentDate: paymentDate || new Date(),
        paymentMethod: paymentMethod || 'Cash',
        notes: notes || `Bulk payment allocation`,
        recordedBy: req.user.email || req.user.username,
      });

      // Update payment status
      if (order.amountDue === 0) {
        order.paymentStatus = 'Paid';
      } else if (order.amountPaid > 0) {
        order.paymentStatus = 'Partial';
      }

      await order.save({ session });

      // Track affected order
      ordersAffected.push({
        orderId: order._id,
        challanNumber: order.challanNumber,
        amountAllocated: amountToAllocate,
        previousDue: previousDue,
        newDue: order.amountDue,
      });

      remainingAmount -= amountToAllocate;

      logger.debug('Payment allocated to order', {
        orderId: order._id,
        challanNumber: order.challanNumber,
        allocated: amountToAllocate,
        newDue: order.amountDue,
      });
    }

    // Add bulk payment to buyer's history
    buyer.bulkPayments.push({
      amount: amount,
      paymentMethod: paymentMethod || 'Cash',
      paymentDate: paymentDate || new Date(),
      notes: notes || '',
      recordedBy: req.user.email || req.user.username,
      recordedByRole: req.user.role,
      ordersAffected: ordersAffected,
    });

    // Update buyer's total due and total paid
    buyer.totalDue = Math.max(0, buyer.totalDue - (amount - remainingAmount));
    buyer.totalPaid += amount - remainingAmount;
    await buyer.save({ session });

    await session.commitTransaction();

    logger.info('Bulk payment recorded successfully', {
      buyerId: buyer._id,
      amount: amount,
      ordersAffected: ordersAffected.length,
      recordedBy: req.user.email,
    });

    res.status(200).json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        amountReceived: amount,
        amountAllocated: amount - remainingAmount,
        remainingAmount: remainingAmount,
        ordersAffected: ordersAffected,
        newTotalDue: buyer.totalDue,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Bulk payment recording failed', {
      error: error.message,
      buyerId: req.params.id,
    });
    res.status(500).json({
      code: 'PAYMENT_FAILED',
      message: 'Failed to record payment',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Get bulk payment history for a buyer
const getBulkPaymentHistory = async (req, res) => {
  try {
    const { id } = req.params; // buyer ID
    const organizationId = req.user.organizationId;

    const buyer = await WholesaleBuyer.findOne({
      _id: id,
      organizationId,
    })
      .select('name mobile businessName bulkPayments')
      .lean();

    if (!buyer) {
      return res.status(404).json({
        code: 'BUYER_NOT_FOUND',
        message: 'Buyer not found',
      });
    }

    // Sort payments by date (newest first)
    const payments = (buyer.bulkPayments || []).sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

    res.json({
      success: true,
      data: {
        buyer: {
          name: buyer.name,
          mobile: buyer.mobile,
          businessName: buyer.businessName,
        },
        payments: payments,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch payment history', {
      error: error.message,
      buyerId: req.params.id,
    });
    res.status(500).json({
      code: 'FETCH_FAILED',
      message: 'Failed to fetch payment history',
      error: error.message,
    });
  }
};

// Update bulk payment (Admin only)
const updateBulkPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id, paymentId } = req.params; // buyer ID and payment ID
    const { amount, paymentMethod, paymentDate, notes } = req.body;
    const organizationId = req.user.organizationId;

    // Admin check is done in route middleware
    const buyer = await WholesaleBuyer.findOne({
      _id: id,
      organizationId,
    }).session(session);

    if (!buyer) {
      await session.abortTransaction();
      return res.status(404).json({
        code: 'BUYER_NOT_FOUND',
        message: 'Buyer not found',
      });
    }

    const payment = buyer.bulkPayments.id(paymentId);

    if (!payment) {
      await session.abortTransaction();
      return res.status(404).json({
        code: 'PAYMENT_NOT_FOUND',
        message: 'Payment record not found',
      });
    }

    // Update payment details (amount cannot be changed to avoid complexity)
    if (paymentMethod) payment.paymentMethod = paymentMethod;
    if (paymentDate) payment.paymentDate = paymentDate;
    if (notes !== undefined) payment.notes = notes;

    await buyer.save({ session });
    await session.commitTransaction();

    logger.info('Bulk payment updated', {
      buyerId: id,
      paymentId: paymentId,
      updatedBy: req.user.email,
    });

    res.json({
      success: true,
      message: 'Payment updated successfully',
      data: payment,
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Payment update failed', {
      error: error.message,
      buyerId: req.params.id,
      paymentId: req.params.paymentId,
    });
    res.status(500).json({
      code: 'UPDATE_FAILED',
      message: 'Failed to update payment',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Delete bulk payment (Admin only)
const deleteBulkPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id, paymentId } = req.params; // buyer ID and payment ID
    const organizationId = req.user.organizationId;

    const buyer = await WholesaleBuyer.findOne({
      _id: id,
      organizationId,
    }).session(session);

    if (!buyer) {
      await session.abortTransaction();
      return res.status(404).json({
        code: 'BUYER_NOT_FOUND',
        message: 'Buyer not found',
      });
    }

    const payment = buyer.bulkPayments.id(paymentId);

    if (!payment) {
      await session.abortTransaction();
      return res.status(404).json({
        code: 'PAYMENT_NOT_FOUND',
        message: 'Payment record not found',
      });
    }

    // Reverse the payment allocation
    for (const orderAffected of payment.ordersAffected) {
      const order = await WholesaleOrder.findById(orderAffected.orderId).session(session);

      if (order) {
        // Restore the due amount
        order.amountDue += orderAffected.amountAllocated;
        order.amountPaid -= orderAffected.amountAllocated;

        // Update payment status
        if (order.amountDue === order.totalAmount) {
          order.paymentStatus = 'Pending';
        } else if (order.amountDue > 0) {
          order.paymentStatus = 'Partial';
        }

        // Remove from payment history
        order.paymentHistory = order.paymentHistory.filter(
          (ph) =>
            !(
              ph.paymentDate.getTime() === payment.paymentDate.getTime() &&
              ph.amount === orderAffected.amountAllocated
            )
        );

        await order.save({ session });
      }
    }

    // Update buyer totals
    const totalAllocated = payment.ordersAffected.reduce((sum, o) => sum + o.amountAllocated, 0);
    buyer.totalDue += totalAllocated;
    buyer.totalPaid -= totalAllocated;

    // Remove payment from history
    buyer.bulkPayments.pull(paymentId);
    await buyer.save({ session });

    await session.commitTransaction();

    logger.info('Bulk payment deleted', {
      buyerId: id,
      paymentId: paymentId,
      deletedBy: req.user.email,
    });

    res.json({
      success: true,
      message: 'Payment deleted successfully',
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Payment deletion failed', {
      error: error.message,
      buyerId: req.params.id,
      paymentId: req.params.paymentId,
    });
    res.status(500).json({
      code: 'DELETE_FAILED',
      message: 'Failed to delete payment',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Preview payment allocation (before recording)
const previewPaymentAllocation = async (req, res) => {
  try {
    const { id } = req.params; // buyer ID
    const { amount } = req.body;
    const organizationId = req.user.organizationId;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        code: 'INVALID_AMOUNT',
        message: 'Amount must be greater than 0',
      });
    }

    const buyer = await WholesaleBuyer.findOne({
      _id: id,
      organizationId,
    });

    if (!buyer) {
      return res.status(404).json({
        code: 'BUYER_NOT_FOUND',
        message: 'Buyer not found',
      });
    }

    // Get all pending orders (oldest first)
    const pendingOrders = await WholesaleOrder.find({
      buyerId: buyer._id,
      organizationId,
      amountDue: { $gt: 0 },
    })
      .sort({ orderDate: 1 })
      .select('challanNumber orderDate amountDue totalAmount items')
      .lean();

    if (pendingOrders.length === 0) {
      return res.status(400).json({
        code: 'NO_PENDING_ORDERS',
        message: 'No pending orders found',
      });
    }

    // Simulate allocation
    let remainingAmount = amount;
    const allocation = [];

    for (const order of pendingOrders) {
      if (remainingAmount <= 0) break;

      const amountToAllocate = Math.min(remainingAmount, order.amountDue);
      const newDue = order.amountDue - amountToAllocate;

      allocation.push({
        orderId: order._id,
        challanNumber: order.challanNumber,
        orderDate: order.orderDate,
        currentDue: order.amountDue,
        amountToAllocate: amountToAllocate,
        newDue: newDue,
        status: newDue === 0 ? 'FULLY_PAID' : 'PARTIALLY_PAID',
        itemsCount: order.items.length,
      });

      remainingAmount -= amountToAllocate;
    }

    res.json({
      success: true,
      data: {
        buyerName: buyer.name,
        totalDue: buyer.totalDue,
        amountReceived: amount,
        allocation: allocation,
        remainingDue: buyer.totalDue - (amount - remainingAmount),
        excessAmount: remainingAmount > 0 ? remainingAmount : 0,
      },
    });
  } catch (error) {
    logger.error('Payment preview failed', {
      error: error.message,
      buyerId: req.params.id,
    });
    res.status(500).json({
      code: 'PREVIEW_FAILED',
      message: 'Failed to preview payment allocation',
      error: error.message,
    });
  }
};

// ✅ UPDATED: Get buyer statistics with correct totals
const getBuyerStats = async (req, res) => {
  try {
    const { organizationId } = req.user;

    // Get order-level stats (includes factory_direct)
    const orderStats = await WholesaleOrder.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(organizationId) } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalOutstanding: { $sum: '$amountDue' },
        },
      },
    ]);

    // Get buyer counts
    const buyerStats = await WholesaleBuyer.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(organizationId) } },
      {
        $group: {
          _id: null,
          totalBuyers: { $sum: 1 },
          buyersWithDue: {
            $sum: {
              $cond: [{ $gt: ['$totalDue', 0] }, 1, 0],
            },
          },
        },
      },
    ]);

    const result = {
      totalBuyers: buyerStats[0]?.totalBuyers || 0,
      totalOutstanding: orderStats[0]?.totalOutstanding || 0,
      totalRevenue: orderStats[0]?.totalRevenue || 0,
      buyersWithDue: buyerStats[0]?.buyersWithDue || 0,
    };

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Failed to fetch buyer stats', { error: error.message });
    res.status(500).json({
      code: 'STATS_FAILED',
      message: 'Failed to fetch statistics',
      error: error.message,
    });
  }
};

// ✅ NEW: Create order borrowing from reserved stock
const createOrderWithReservedBorrow = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      buyerName, buyerContact, buyerEmail, buyerAddress, businessName, gstNumber,
      deliveryDate, items, subtotalAmount, discountType, discountValue, discountAmount,
      gstEnabled, gstAmount, cgst, sgst, totalAmount, amountPaid, paymentMethod, notes,
      fulfillmentType, borrowFromReserved
    } = req.body;
    const { organizationId } = req.user;

    if (!borrowFromReserved) {
      await session.abortTransaction();
      return res.status(400).json({
        code: 'INVALID_REQUEST',
        message: 'This endpoint requires borrowFromReserved flag',
      });
    }

    // Find or create buyer (same as before)
    let buyer = await WholesaleBuyer.findOne({ mobile: buyerContact, organizationId }).session(session);
    if (!buyer) {
      buyer = await WholesaleBuyer.create([{
        name: buyerName,
        mobile: buyerContact,
        email: buyerEmail || '',
        address: buyerAddress || '',
        businessName: businessName || buyerName,
        gstNumber: gstNumber || '',
        organizationId,
        creditLimit: 0,
        totalDue: 0,
        isTrusted: false,
      }], { session });
      buyer = buyer[0];
    }

    // ✅ Deduct stock (main + reserved)
    for (const item of items) {
      const product = await Product.findOne({ design: item.design, organizationId }).session(session);
      const colorVariant = product.colors.find(c => c.color === item.color);
      const sizeIndex = colorVariant.sizes.findIndex(s => s.size === item.size);

      const mainStock = colorVariant.sizes[sizeIndex].currentStock;
      const reservedStock = colorVariant.sizes[sizeIndex].reservedStock || 0;

      if (item.quantity <= mainStock) {
        colorVariant.sizes[sizeIndex].currentStock -= item.quantity;
      } else {
        const borrowAmount = item.quantity - mainStock;
        colorVariant.sizes[sizeIndex].currentStock = 0;
        colorVariant.sizes[sizeIndex].reservedStock -= borrowAmount;

        // ✅ Log transfer
        await Transfer.create([{
          design: item.design,
          color: item.color,
          size: item.size,
          quantity: borrowAmount,
          from: 'reserved',
          to: 'main',
          type: 'emergency_borrow',
          mainStockBefore: mainStock,
          mainStockAfter: 0,
          reservedStockBefore: reservedStock,
          reservedStockAfter: reservedStock - borrowAmount,
          performedBy: req.user._id,
          notes: `Emergency borrow for Wholesale Order`,
          organizationId
        }], { session });

        console.log(`✅ Borrowed ${borrowAmount} from Reserved for ${item.design} ${item.color} ${item.size}`);
      }

      await product.save({ session });
    }

    // Generate challan number
    const challanNumber = await generateChallanNumber(businessName || buyerName, buyerContact, organizationId, session);
    const amountDue = totalAmount - (amountPaid || 0);
    const paymentStatus = amountDue === 0 ? 'Paid' : amountPaid > 0 ? 'Partial' : 'Pending';

    // Create order
    const order = await WholesaleOrder.create([{
      challanNumber,
      buyerId: buyer._id,
      buyerName,
      buyerContact,
      buyerEmail: buyerEmail || '',
      buyerAddress: buyerAddress || '',
      businessName: businessName || buyerName,
      gstNumber: gstNumber || '',
      deliveryDate: deliveryDate || null,
      items,
      subtotalAmount,
      discountType: discountType || 'none',
      discountValue: discountValue || 0,
      discountAmount: discountAmount || 0,
      gstEnabled: gstEnabled || false,
      gstAmount: gstAmount || 0,
      cgst: cgst || 0,
      sgst: sgst || 0,
      totalAmount,
      amountPaid: amountPaid || 0,
      amountDue,
      paymentStatus,
      paymentMethod: paymentMethod || 'Cash',
      orderStatus: 'Delivered',
      notes: notes || '',
      fulfillmentType: fulfillmentType || 'warehouse',
      organizationId,
      createdBy: req.user._id,
    }], { session });

    buyer.totalDue = (buyer.totalDue || 0) + amountDue;
    buyer.totalOrders = (buyer.totalOrders || 0) + 1;
    buyer.lastOrderDate = new Date();
    await buyer.save({ session });

    await session.commitTransaction();
    logger.info('Wholesale order created with reserved borrow', { orderId: order[0]._id });
    res.status(201).json(order[0]);

  } catch (error) {
    await session.abortTransaction();
    logger.error('Wholesale order with reserved borrow failed', { error: error.message });
    res.status(500).json({
      code: 'ORDER_CREATION_FAILED',
      message: 'Failed to create order',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

module.exports = {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  getPendingPayments,
  getAllBuyers,
  getBuyerByMobile,
  getBuyerHistory,
  updateBuyerCredit,
  updateBuyerTrust,
  updateBuyerEmail,
  updatePaymentHistory,
  sendCreditWarning,
  previewChallanNumber,
  recordBulkPayment,
  getBulkPaymentHistory,
  updateBulkPayment,
  deleteBulkPayment,
  previewPaymentAllocation,
  getBuyerStats,
  sendChallanEmail,
  createOrderWithReservedBorrow,
};
