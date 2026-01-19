const WholesaleOrder = require('../models/WholesaleOrder');
const WholesaleBuyer = require('../models/WholesaleBuyer');
const MonthlyBill = require('../models/MonthlyBill');
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

const getAllOrders = async (req, res) => {
  try {
    const { organizationId } = req.user;
    // ✅ FEATURE 1: Filter out soft-deleted orders
    const orders = await WholesaleOrder.find({ 
      organizationId,
      deletedAt: null // Only show active orders
    })
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

// UPDATED: Create Order with GST recalculation from settings
const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let { 
      items,
      buyerName,
      buyerContact,
      buyerEmail,
      buyerAddress,
      businessName,
      gstNumber,
      deliveryDate,
      subtotalAmount,
      discountType,
      discountValue,
      discountAmount,
      gstEnabled,
      // ⚠️ DON'T TRUST THESE FROM FRONTEND
      // gstAmount,
      // cgst,
      // sgst,
      // totalAmount,
      amountPaid,
      paymentMethod,
      notes,
      fulfillmentType,
    } = req.body;

    const organizationId = req.user.organizationId;

    // Validation
    if (!buyerContact || !items || items.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ 
        code: 'INVALID_DATA', 
        message: 'Buyer contact and items are required' 
      });
    }

    // ⭐ STEP 1: Fetch GST percentage from settings (BACKEND SOURCE OF TRUTH)
    const settings = await Settings.findOne({ organizationId });
    const gstPercentage = settings?.gstPercentage || 5; // Default 5% if not set

    logger.info('GST Settings fetched', { 
      organizationId, 
      gstPercentage,
      gstEnabled: gstEnabled !== false 
    });

    // ⭐ STEP 2: Recalculate all financial values on backend
    // Calculate subtotal from items
    const calculatedSubtotal = items.reduce((sum, item) => {
      return sum + (item.quantity * item.pricePerUnit);
    }, 0);

    // Calculate discount amount
    let calculatedDiscountAmount = 0;
    if (discountType === 'percentage') {
      calculatedDiscountAmount = (calculatedSubtotal * (discountValue || 0)) / 100;
    } else if (discountType === 'fixed') {
      calculatedDiscountAmount = discountValue || 0;
    }
    
    // Ensure discount doesn't exceed subtotal
    if (calculatedDiscountAmount > calculatedSubtotal) {
      calculatedDiscountAmount = calculatedSubtotal;
    }

    // Calculate taxable amount (after discount)
    const taxableAmount = calculatedSubtotal - calculatedDiscountAmount;

    // Calculate GST
    let calculatedGstAmount = 0;
    let calculatedCgst = 0;
    let calculatedSgst = 0;
    
    if (gstEnabled !== false) {
      calculatedGstAmount = (taxableAmount * gstPercentage) / 100;
      calculatedCgst = calculatedGstAmount / 2;
      calculatedSgst = calculatedGstAmount / 2;
    }

    // Calculate final total
    const calculatedTotalAmount = taxableAmount + calculatedGstAmount;

    logger.info('Financial calculations completed', {
      subtotal: calculatedSubtotal,
      discountAmount: calculatedDiscountAmount,
      taxableAmount,
      gstPercentage,
      gstAmount: calculatedGstAmount,
      cgst: calculatedCgst,
      sgst: calculatedSgst,
      totalAmount: calculatedTotalAmount
    });

    // Check for duplicate orders within last 1 minute
    const recentOrder = await WholesaleOrder.findOne({
      buyerContact,
      organizationId,
      createdAt: { $gte: new Date(Date.now() - 60000) },
      totalAmount: calculatedTotalAmount,
    }).session(session);

    if (recentOrder) {
      await session.abortTransaction();
      return res.status(400).json({ 
        code: 'DUPLICATE_ORDER', 
        message: 'Duplicate order detected. Please wait before creating another order.' 
      });
    }

    // Find or create buyer
    let buyer = await WholesaleBuyer.findOne({ 
      mobile: buyerContact, 
      organizationId 
    }).session(session);

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
      logger.info('New buyer created', { buyerId: buyer._id, name: buyerName });
    } else {
      // Update existing buyer if new data is provided
      let needsUpdate = false;
      if (buyerEmail && buyerEmail !== buyer.email) {
        buyer.email = buyerEmail;
        needsUpdate = true;
      }
      if (buyerAddress && buyerAddress !== buyer.address) {
        buyer.address = buyerAddress;
        needsUpdate = true;
      }
      if (gstNumber && gstNumber !== buyer.gstNumber) {
        buyer.gstNumber = gstNumber;
        needsUpdate = true;
      }
      if (businessName && businessName !== buyer.businessName) {
        buyer.businessName = businessName;
        needsUpdate = true;
      }
      if (needsUpdate) {
        await buyer.save({ session });
        logger.info('Buyer details updated during order creation', { 
          buyerId: buyer._id, 
          mobile: buyerContact 
        });
      }
    }

    // Stock validation and deduction (keep your existing logic)
    if (fulfillmentType !== 'factory_direct') {
      const insufficientStockItems = [];
      const adjustedItems = [];

      // STEP 1: Calculate max available per item
      for (const item of items) {
        const product = await Product.findOne({ 
          design: item.design, 
          organizationId 
        }).session(session);

        if (!product) {
          await session.abortTransaction();
          return res.status(404).json({ 
            code: 'PRODUCT_NOT_FOUND', 
            message: `Product not found: ${item.design}` 
          });
        }

        const colorVariant = product.colors.find(c => c.color === item.color);
        if (!colorVariant) {
          await session.abortTransaction();
          return res.status(404).json({ 
            code: 'PRODUCT_NOT_FOUND', 
            message: `Color ${item.color} not found for ${item.design}` 
          });
        }

        const sizeIndex = colorVariant.sizes.findIndex(s => s.size === item.size);
        if (sizeIndex === -1) {
          await session.abortTransaction();
          return res.status(404).json({ 
            code: 'PRODUCT_NOT_FOUND', 
            message: `Size ${item.size} not found for ${item.design} ${item.color}` 
          });
        }

        const currentStock = colorVariant.sizes[sizeIndex].currentStock || 0;
        const reservedStock = colorVariant.sizes[sizeIndex].reservedStock || 0;
        const requestedQty = item.quantity;

        const maxAvailableFromMain = Math.min(requestedQty, Math.max(0, currentStock));

        adjustedItems.push({
          ...item,
          requestedQty: requestedQty,
          availableMain: maxAvailableFromMain,
          availableReserved: reservedStock,
          shortfall: requestedQty - maxAvailableFromMain,
          productRef: product,
          colorVariant: colorVariant,
          sizeIndex: sizeIndex
        });
      }

      // STEP 2: Calculate totals
      const totalRequested = adjustedItems.reduce((sum, item) => sum + item.requestedQty, 0);
      const totalAvailableMain = adjustedItems.reduce((sum, item) => sum + item.availableMain, 0);
      const totalShortfall = totalRequested - totalAvailableMain;

      // STEP 3: Check if we need reserved stock
      if (totalShortfall > 0) {
        const totalAvailableReserved = adjustedItems.reduce((sum, item) => sum + item.availableReserved, 0);
        
        if (totalAvailableReserved >= totalShortfall) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            code: 'MAIN_INSUFFICIENT_BORROW_RESERVED',
            message: 'Main inventory insufficient. Reserved stock borrowing required.',
            canBorrowFromReserved: true,
            totalRequested,
            totalAvailableMain,
            totalShortfall,
            totalAvailableReserved,
            insufficientItems: adjustedItems.filter(item => item.shortfall > 0).map(item => ({
              design: item.design,
              color: item.color,
              size: item.size,
              requestedQty: item.requestedQty,
              mainStock: item.availableMain,
              reservedStock: item.availableReserved,
              neededFromReserved: item.shortfall
            }))
          });
        } else {
          const totalMaxAvailable = totalAvailableMain + totalAvailableReserved;
          
          if (totalMaxAvailable === 0) {
            await session.abortTransaction();
            return res.status(400).json({
              code: 'ZERO_STOCK',
              message: 'Cannot create order with 0 pieces. No stock available in main or reserved inventory.'
            });
          }

          // Proceed with partial fulfillment
          for (const item of adjustedItems) {
            const { productRef, colorVariant, sizeIndex, availableMain, shortfall, availableReserved } = item;

            if (availableMain > 0) {
              const currentStock = colorVariant.sizes[sizeIndex].currentStock;
              const actualDeduction = Math.min(availableMain, currentStock);
              colorVariant.sizes[sizeIndex].currentStock = Math.max(0, currentStock - actualDeduction);
            }

            if (shortfall > 0 && availableReserved > 0) {
              const takeFromReserved = Math.min(shortfall, availableReserved);
              const currentReserved = colorVariant.sizes[sizeIndex].reservedStock || 0;
              const actualReservedDeduction = Math.min(takeFromReserved, currentReserved);
              colorVariant.sizes[sizeIndex].reservedStock = Math.max(0, currentReserved - actualReservedDeduction);
            }

            await productRef.save({ session });
          }

          items = adjustedItems.map(item => {
            const actualQty = item.availableMain + Math.min(item.shortfall, item.availableReserved);
            return {
              design: item.design,
              color: item.color,
              size: item.size,
              quantity: actualQty,
              pricePerUnit: item.pricePerUnit,
              discount: item.discount || 0
            };
          }).filter(item => item.quantity > 0);

          if (items.length === 0) {
            await session.abortTransaction();
            return res.status(400).json({
              code: 'ZERO_STOCK',
              message: 'Cannot create order. No stock available for any items.'
            });
          }
        }
      } else {
        // Sufficient stock - deduct from main
        for (const item of adjustedItems) {
          const { productRef, colorVariant, sizeIndex, requestedQty } = item;
          colorVariant.sizes[sizeIndex].currentStock -= requestedQty;
          await productRef.save({ session });
        }
      }
    } else {
      logger.info('Factory direct order - skipping stock deduction', { organizationId });
    }

    // Generate challan number
    const challanNumber = await generateChallanNumber(businessName || buyerName, organizationId, session);

    // Calculate amount due
    const amountDue = calculatedTotalAmount - (amountPaid || 0);
    const paymentStatus = amountDue <= 0 ? 'Paid' : (amountPaid > 0 ? 'Partial' : 'Pending');

    // ⭐ STEP 3: Create order with RECALCULATED values
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
      subtotalAmount: calculatedSubtotal,
      discountType: discountType || 'none',
      discountValue: discountValue || 0,
      discountAmount: calculatedDiscountAmount,
      gstEnabled: gstEnabled !== false,
      gstPercentage: gstPercentage, // ⭐ STORE THE PERCENTAGE USED
      gstAmount: calculatedGstAmount, // ⭐ BACKEND CALCULATED
      cgst: calculatedCgst, // ⭐ BACKEND CALCULATED
      sgst: calculatedSgst, // ⭐ BACKEND CALCULATED
      totalAmount: calculatedTotalAmount, // ⭐ BACKEND CALCULATED
      amountPaid: amountPaid || 0,
      amountDue: amountDue,
      paymentStatus,
      paymentMethod: paymentMethod || 'Cash',
      orderStatus: 'Delivered',
      notes: notes || '',
      fulfillmentType: fulfillmentType || 'warehouse',
      organizationId,
      createdBy: {
        userId: req.user._id,
        userName: req.user.name || req.user.email,
        userRole: req.user.role,
        createdAt: new Date()
      },
    }], { session });

    // Update buyer's total due
    buyer.totalDue = (buyer.totalDue || 0) + amountDue;
    buyer.totalOrders = (buyer.totalOrders || 0) + 1;
    buyer.lastOrderDate = new Date();
    await buyer.save({ session });

    await session.commitTransaction();

    logger.info('Order created successfully', { 
      orderId: order[0]._id, 
      challanNumber,
      totalAmount: calculatedTotalAmount,
      gstPercentage,
      gstAmount: calculatedGstAmount,
      fulfillmentType: fulfillmentType || 'warehouse'
    });

    // Auto-email logic (keep your existing code)
    try {
      const settings = await Settings.findOne({ organizationId });
      if (settings?.notifications?.autoEmailChallan && buyerEmail) {
        // Your existing email code here
      }
    } catch (settingsError) {
      logger.warn('Failed to check auto-email setting', { error: settingsError.message });
    }

    // Check notifications
    try {
      await checkBuyerNotifications(buyer._id);
    } catch (notifError) {
      logger.error('Notification check failed', { 
        error: notifError.message, 
        buyerId: buyer._id 
      });
    }

    res.status(201).json(order[0]);

  } catch (error) {
    await session.abortTransaction();
    logger.error('Order creation failed', { 
      error: error.message, 
      stack: error.stack 
    });
    res.status(500).json({ 
      code: 'ORDER_CREATION_FAILED', 
      message: 'Failed to create order', 
      error: error.message 
    });
  } finally {
    session.endSession();
  }
};

// FIXED: Generate challan number - Reuse ONLY latest deleted, skip old gaps
const generateChallanNumber = async (businessName, organizationId, session) => {
  try {
    // Clean business name for consistent formatting
    const cleanBusinessName = businessName
      .replace(/[^a-zA-Z0-9 ]/g, '') // Remove special characters, keep spaces
      .replace(/ /g, '_')             // Replace spaces with underscores
      .toUpperCase();                 // Convert to uppercase
    
    // Get all ACTIVE (non-deleted) orders for this business
    const existingOrders = await WholesaleOrder.find({
      businessName: businessName,
      organizationId,
      deletedAt: null, // Only active orders
    })
      .select('challanNumber')
      .session(session)
      .lean();
    
    // Extract sequence numbers from active challans
    const usedNumbers = existingOrders
      .map(order => {
        // Extract number from format: SNELLY23 → 23
        const match = order.challanNumber.match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter(num => num !== null)
      .sort((a, b) => a - b);
    
    // ✅ KEY LOGIC: Find HIGHEST number and add 1
    // This automatically reuses the latest deleted number!
    const maxSequence = usedNumbers.length > 0 
      ? Math.max(...usedNumbers) 
      : 0;
    
    const orderNumber = maxSequence + 1;
    
    // Format: BUSINESSNAME + NUMBER
    const challanNumber = `${cleanBusinessName}_${String(orderNumber).padStart(2, '0')}`;
    
    logger.debug('Challan number generated', {
      businessName,
      cleanBusinessName,
      activeOrdersCount: existingOrders.length,
      usedNumbers: usedNumbers,
      maxSequence,
      orderNumber,
      challanNumber,
    });
    
    return challanNumber;
    
  } catch (error) {
    logger.error('Challan number generation failed', { error: error.message });
    // Fallback to timestamp-based if generation fails
    return `CH${Date.now().toString().slice(-8)}`;
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
  // ✅ FEATURE 2: Track what changed
  const changesBefore = {};
  const changesAfter = {};
  const fieldsToTrack = [
    'buyerName', 'buyerContact', 'buyerEmail', 'buyerAddress',
    'businessName', 'gstNumber', 'deliveryDate', 'notes',
    'discountType', 'discountValue', 'amountPaid', 'paymentMethod'
  ];

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
    // ✅ FEATURE 2: Track edit history
    if (Object.keys(req.body).length > 0) {
      const changesBefore = {};
      const changesAfter = {};
      
      // Track changes to specific fields
      const fieldsToTrack = [
        'buyerName', 'buyerContact', 'buyerEmail', 'buyerAddress',
        'businessName', 'gstNumber', 'deliveryDate', 'notes',
        'discountType', 'discountValue', 'amountPaid', 'paymentMethod'
      ];
      
      fieldsToTrack.forEach(field => {
        if (req.body[field] !== undefined && req.body[field] !== existingOrder[field]) {
          changesBefore[field] = existingOrder[field];
          changesAfter[field] = req.body[field];
        }
      });
      
      // Track item changes
      if (req.body.items) {
        changesBefore.items = existingOrder.items;
        changesAfter.items = req.body.items;
      }
      
      // Add edit history entry if there are changes
      if (Object.keys(changesBefore).length > 0) {
        existingOrder.editHistory.push({
          editedBy: {
            userId: req.user._id,
            userName: req.user.name || req.user.email,
            userRole: req.user.role
          },
          editedAt: new Date(),
          changes: {
            before: changesBefore,
            after: changesAfter
          }
        });
      }
    }
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

// FEATURE 1: Soft Delete Order
const deleteOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { organizationId, id: userId, name, email, role } = req.user;

    const order = await WholesaleOrder.findOne({ 
      _id: id, 
      organizationId, 
      deletedAt: null  // Only allow deleting active orders
    }).session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ 
        code: 'ORDER_NOT_FOUND', 
        message: 'Order not found or already deleted' 
      });
    }

    // ✅ STEP 1: Restore stock to MAIN inventory (not reserved)
    if (order.fulfillmentType !== 'factorydirect') {
      for (const item of order.items) {
        const product = await Product.findOne({ 
          design: item.design, 
          organizationId 
        }).session(session);

        if (product) {
          const colorVariant = product.colors.find(c => c.color === item.color);
          if (colorVariant) {
            const sizeIndex = colorVariant.sizes.findIndex(s => s.size === item.size);
            if (sizeIndex !== -1) {
              // ✅ CORRECT: Restore to MAIN inventory (currentStock)
              colorVariant.sizes[sizeIndex].currentStock += item.quantity;
              await product.save({ session });

              logger.debug('Stock restored to main', {
                design: item.design,
                color: item.color,
                size: item.size,
                restoredQty: item.quantity,
                newMainStock: colorVariant.sizes[sizeIndex].currentStock
              });
            }
          }
        }
      }
    }

    // STEP 2: Adjust buyer's totalDue
    if (order.buyerId) {
      const buyer = await WholesaleBuyer.findById(order.buyerId).session(session);
      if (buyer) {
        buyer.totalDue = Math.max(0, (buyer.totalDue || 0) - (order.amountDue || 0));
        buyer.totalOrders = Math.max(0, (buyer.totalOrders || 0) - 1);
        await buyer.save({ session });
      }
    }

    // STEP 3: Remove from monthly bills if present
    const bills = await MonthlyBill.find({ 
      organizationId, 
      'orders.orderId': id 
    }).session(session);

    for (const bill of bills) {
      bill.orders = bill.orders.filter(o => o.orderId.toString() !== id);
      
      // Recalculate bill financials
      const newSubtotal = bill.orders.reduce((sum, o) => sum + (o.subtotalAmount || 0), 0);
      const newGst = bill.orders.reduce((sum, o) => sum + (o.gstAmount || 0), 0);
      const newTotal = bill.orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

      bill.financials.subtotalAmount = newSubtotal;
      bill.financials.gstAmount = newGst;
      bill.financials.totalAmount = newTotal;
      bill.financials.balanceDue = newTotal - (bill.financials.amountPaid || 0);

      await bill.save({ session });
    }

    // ✅ STEP 4: Soft delete the order
    order.deletedAt = new Date();
    order.deletedBy = userId;
    order.deletionReason = 'User initiated deletion';
    await order.save({ session });

    // ✅ NO TRANSFER RECORD NEEDED FOR SOFT DELETE

    await session.commitTransaction();

    logger.info('Order soft deleted successfully', { 
      orderId: id, 
      deletedBy: `${name} ${email}`,
      stockRestored: order.fulfillmentType !== 'factorydirect'
    });

    res.json({ 
      success: true, 
      message: 'Order deleted successfully', 
      stockRestored: order.fulfillmentType !== 'factorydirect'
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Order deletion failed', { error: error.message, orderId: req.params.id });
    res.status(500).json({ 
      code: 'DELETE_FAILED', 
      message: 'Failed to delete order', 
      error: error.message 
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

// ✅ FIXED: Get all buyers with bill-based totals
const getAllBuyers = async (req, res) => {
  try {
    const { organizationId } = req.user;

    const buyers = await WholesaleBuyer.find({ organizationId })
      .select('name mobile email businessName gstNumber address creditLimit totalDue totalPaid totalSpent totalOrders lastOrderDate monthlyBills')
      .lean()
      .sort({ lastOrderDate: -1 });

    // Calculate totals from monthlyBills if exists, else fallback to old method
    const enrichedBuyers = buyers.map(buyer => {
      if (buyer.monthlyBills && buyer.monthlyBills.length > 0) {
        // ✅ NEW: Calculate from bills
        const totalDue = buyer.monthlyBills.reduce((sum, bill) => sum + (bill.balanceDue || 0), 0);
        const totalPaid = buyer.monthlyBills.reduce((sum, bill) => sum + (bill.amountPaid || 0), 0);
        const totalSpent = buyer.monthlyBills.reduce((sum, bill) => sum + (bill.invoiceTotal || 0), 0);
        
        return {
          ...buyer,
          totalDue: parseFloat(totalDue.toFixed(2)),
          totalPaid: parseFloat(totalPaid.toFixed(2)),
          totalSpent: parseFloat(totalSpent.toFixed(2)),
          totalOrders: buyer.monthlyBills.length,
          hasBills: true
        };
      } else {
        // ✅ OLD: Fallback for buyers without bills (use existing data)
        return {
          ...buyer,
          totalDue: buyer.totalDue || 0,
          totalPaid: buyer.totalPaid || 0,
          totalSpent: buyer.totalSpent || 0,
          totalOrders: buyer.totalOrders || 0,
          hasBills: false
        };
      }
    });

    res.json(enrichedBuyers);
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

// ✅ NEW: Smart payment recording (bill-aware)
const recordSmartPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params; // buyer ID
    const { amount, paymentMethod, paymentDate, notes } = req.body;
    const organizationId = req.user.organizationId;

    if (!amount || amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        code: 'INVALID_AMOUNT',
        message: 'Invalid payment amount'
      });
    }

    const buyer = await WholesaleBuyer.findOne({
      _id: id,
      organizationId
    }).session(session);

    if (!buyer) {
      await session.abortTransaction();
      return res.status(404).json({
        code: 'BUYER_NOT_FOUND',
        message: 'Buyer not found'
      });
    }

    let remainingAmount = parseFloat(amount);
    const paymentRecord = {
      amount: parseFloat(amount),
      paymentDate: paymentDate || new Date(),
      paymentMethod: paymentMethod || 'Cash',
      notes: notes || '',
      recordedBy: req.user.email || req.user.username,
      recordedByRole: req.user.role
    };

    // ✅ STEP 1: Check if bills exist for this buyer
    const bills = await MonthlyBill.find({
      organizationId,
      'buyer.id': id,
      'financials.balanceDue': { $gt: 0 }
    })
      .sort({ 'billingPeriod.year': 1, 'billingPeriod.month': 1 }) // Oldest first
      .session(session);

    if (bills.length > 0) {
      // ✅ Bills exist - allocate payment to bills
      logger.info('Bills found - allocating payment to bills', {
        buyerId: id,
        billsCount: bills.length,
        amount
      });

      const billsAffected = [];

      for (const bill of bills) {
        if (remainingAmount <= 0) break;

        const amountToAllocate = Math.min(remainingAmount, bill.financials.balanceDue);

        // Update bill
        bill.financials.amountPaid += amountToAllocate;
        bill.financials.balanceDue -= amountToAllocate;

        if (bill.financials.balanceDue <= 0) {
          bill.status = 'paid';
          bill.paidAt = new Date();
        } else {
          bill.status = 'partial';
        }

        bill.paymentHistory.push({
          ...paymentRecord,
          amount: amountToAllocate,
          notes: notes || `Payment allocation`
        });

        await bill.save({ session });

        // Update buyer's bill tracking
        const buyerBillIndex = buyer.monthlyBills.findIndex(
          b => b.billId.toString() === bill._id.toString()
        );

        if (buyerBillIndex !== -1) {
          buyer.monthlyBills[buyerBillIndex].amountPaid = bill.financials.amountPaid;
          buyer.monthlyBills[buyerBillIndex].balanceDue = bill.financials.balanceDue;
          buyer.monthlyBills[buyerBillIndex].status = bill.status;
        }

        billsAffected.push({
          billId: bill._id,
          billNumber: bill.billNumber,
          month: bill.billingPeriod.month,
          year: bill.billingPeriod.year,
          amountAllocated: amountToAllocate,
          newBalance: bill.financials.balanceDue
        });

        remainingAmount -= amountToAllocate;

        logger.info('Payment allocated to bill', {
          billId: bill._id,
          billNumber: bill.billNumber,
          allocated: amountToAllocate,
          newBalance: bill.financials.balanceDue
        });
      }

      // Update buyer totals
      buyer.totalDue = buyer.monthlyBills.reduce((sum, b) => sum + b.balanceDue, 0);
      buyer.totalPaid = buyer.monthlyBills.reduce((sum, b) => sum + b.amountPaid, 0);

      await buyer.save({ session });
      await session.commitTransaction();

      res.json({
        success: true,
        message: 'Payment recorded and allocated to bills',
        data: {
          amountReceived: amount,
          amountAllocated: amount - remainingAmount,
          remainingAmount,
          billsAffected,
          newTotalDue: buyer.totalDue
        }
      });

    } else {
      // ✅ No bills - use old challan-based system
      logger.info('No bills found - using challan-based payment', {
        buyerId: id,
        amount
      });

      // Get unpaid orders
      const orders = await WholesaleOrder.find({
        buyerId: buyer._id,
        organizationId,
        amountDue: { $gt: 0 }
      })
        .sort({ createdAt: 1 })
        .session(session);

      if (orders.length === 0) {
        await session.abortTransaction();
        return res.status(400).json({
          code: 'NO_PENDING_ORDERS',
          message: 'No pending orders found for this buyer'
        });
      }

      const ordersAffected = [];

      // Allocate to orders
      for (const order of orders) {
        if (remainingAmount <= 0) break;

        const previousDue = order.amountDue;
        const amountToAllocate = Math.min(remainingAmount, order.amountDue);

        order.amountPaid += amountToAllocate;
        order.amountDue -= amountToAllocate;

        if (order.amountDue === 0) {
          order.paymentStatus = 'Paid';
        } else if (order.amountPaid > 0) {
          order.paymentStatus = 'Partial';
        }

        order.paymentHistory = order.paymentHistory || [];
        order.paymentHistory.push({
          ...paymentRecord,
          amount: amountToAllocate
        });

        await order.save({ session });

        ordersAffected.push({
          orderId: order._id,
          challanNumber: order.challanNumber,
          amountAllocated: amountToAllocate,
          previousDue,
          newDue: order.amountDue
        });

        remainingAmount -= amountToAllocate;
      }

      // Add to buyer's bulk payments
      buyer.bulkPayments.push({
        ...paymentRecord,
        ordersAffected
      });

      buyer.totalDue = Math.max(0, buyer.totalDue - (amount - remainingAmount));
      buyer.totalPaid += amount - remainingAmount;

      await buyer.save({ session });
      await session.commitTransaction();

      res.json({
        success: true,
        message: 'Payment recorded and allocated to orders',
        data: {
          amountReceived: amount,
          amountAllocated: amount - remainingAmount,
          remainingAmount,
          ordersAffected,
          newTotalDue: buyer.totalDue
        }
      });
    }

  } catch (error) {
    await session.abortTransaction();
    logger.error('Smart payment recording failed:', error.message);
    res.status(500).json({
      code: 'PAYMENT_FAILED',
      message: 'Failed to record payment',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// ✅ UPDATED: Get complete payment history for a buyer (challans + bills)
const getBulkPaymentHistory = async (req, res) => {
  try {
    const { id } = req.params; // buyer ID
    const organizationId = req.user.organizationId;

    const buyer = await WholesaleBuyer.findOne({
      _id: id,
      organizationId,
    })
      .select('name mobile businessName bulkPayments monthlyBills')
      .lean();

    if (!buyer) {
      return res.status(404).json({
        code: 'BUYER_NOT_FOUND',
        message: 'Buyer not found',
      });
    }

    // STEP 1: Get challan payments (before bill generation)
    const orders = await WholesaleOrder.find({
      buyerId: id,
      organizationId
    }).select('challanNumber paymentHistory createdAt').lean();

    const challanPayments = [];
    for (const order of orders) {
      if (order.paymentHistory && order.paymentHistory.length > 0) {
        order.paymentHistory.forEach(payment => {
          challanPayments.push({
            amount: payment.amount,
            paymentDate: payment.paymentDate,
            paymentMethod: payment.paymentMethod || 'Cash',
            notes: payment.notes || `Payment for challan ${order.challanNumber}`,
            recordedBy: payment.recordedBy || 'System',
            recordedByRole: payment.recordedByRole || 'admin',
            source: 'challan',
            challanNumber: order.challanNumber,
            orderId: order._id
          });
        });
      }
    }

    // STEP 2: Get bill payments (after bill generation)
    const bills = await MonthlyBill.find({
      organizationId,
      'buyer.id': id,
    }).select('billNumber billingPeriod paymentHistory').lean();

    const billPayments = [];
    for (const bill of bills) {
      if (bill.paymentHistory && bill.paymentHistory.length > 0) {
        bill.paymentHistory.forEach(payment => {
          // Only include payments recorded AFTER bill generation (not challan payments copied during generation)
          const isAfterBill = !payment.notes || !payment.notes.includes('Payment for challan');
          
          if (isAfterBill) {
            billPayments.push({
              amount: payment.amount,
              paymentDate: payment.paymentDate,
              paymentMethod: payment.paymentMethod || 'Cash',
              notes: payment.notes || 'Payment allocation',
              recordedBy: payment.recordedBy || 'System',
              recordedByRole: payment.recordedByRole || 'admin',
              source: 'bill',
              billNumber: bill.billNumber,
              billMonth: bill.billingPeriod.month,
              billYear: bill.billingPeriod.year,
              billId: bill._id
            });
          }
        });
      }
    }

    // STEP 3: Merge and sort all payments (newest first)
    const allPayments = [...challanPayments, ...billPayments]
      .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

    res.json({
      success: true,
      data: {
        buyer: {
          name: buyer.name,
          mobile: buyer.mobile,
          businessName: buyer.businessName,
        },
        payments: allPayments,
        summary: {
          totalPayments: allPayments.length,
          challanPayments: challanPayments.length,
          billPayments: billPayments.length,
          totalAmount: allPayments.reduce((sum, p) => sum + p.amount, 0)
        }
      },
    });
  } catch (error) {
    logger.error('Failed to fetch payment history', {
      error: error.message,
      buyerId: req.params.id,
    });
    res.status500.json({
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

// ✅ Get buyer statistics with accurate totals
const getBuyerStats = async (req, res) => {
  try {
    const { organizationId } = req.user;

    // Get all buyers and sum their individual totals (source of truth)
    const buyers = await WholesaleBuyer.find({ organizationId }).lean();

    const totalBuyers = buyers.length;
    
    // Count buyers with pending dues
    const buyersWithDue = buyers.filter(b => (b.totalDue || 0) > 0).length;
    
    // Sum from individual buyer records (accurate)
    const totalOutstanding = buyers.reduce((sum, b) => sum + (b.totalDue || 0), 0);
    
    // Calculate total revenue from totalSpent field
    const totalRevenue = buyers.reduce((sum, b) => sum + (b.totalSpent || 0), 0);

    logger.info('Buyer stats calculated', {
      organizationId,
      totalBuyers,
      buyersWithDue,
      totalOutstanding,
      totalRevenue
    });

    res.json({
      totalBuyers,
      buyersWithDue,
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100
    });
  } catch (error) {
    logger.error('Failed to fetch buyer stats', { error: error.message });
    res.status(500).json({ 
      code: 'STATS_FAILED', 
      message: 'Failed to fetch statistics', 
      error: error.message 
    });
  }
};

// NEW: Create order borrowing from reserved stock
const createOrderWithReservedBorrow = async (req, res) => {
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
      borrowFromReserved
    } = req.body;

    const organizationId = req.user.organizationId;

    // Validate borrowFromReserved flag
    if (!borrowFromReserved) {
      await session.abortTransaction();
      return res.status(400).json({
        code: 'INVALID_REQUEST',
        message: 'This endpoint requires borrowFromReserved flag'
      });
    }

    // ✅ STEP 1: Fetch GST settings and recalculate (BACKEND SOURCE OF TRUTH)
    const settings = await Settings.findOne({ organizationId });
    const gstPercentage = settings?.gstPercentage || 5;

    logger.info('GST Settings fetched', { organizationId, gstPercentage, gstEnabled: gstEnabled !== false });

    // ✅ STEP 2: Recalculate all financial values
    const calculatedSubtotal = items.reduce((sum, item) => {
      return sum + (item.quantity * item.pricePerUnit);
    }, 0);

    // Calculate discount amount
    let calculatedDiscountAmount = 0;
    if (discountType === 'percentage') {
      calculatedDiscountAmount = (calculatedSubtotal * (discountValue || 0)) / 100;
    } else if (discountType === 'fixed') {
      calculatedDiscountAmount = discountValue || 0;
    }

    // Ensure discount doesn't exceed subtotal
    if (calculatedDiscountAmount > calculatedSubtotal) {
      calculatedDiscountAmount = calculatedSubtotal;
    }

    // Calculate taxable amount after discount
    const taxableAmount = calculatedSubtotal - calculatedDiscountAmount;

    // Calculate GST
    let calculatedGstAmount = 0;
    let calculatedCgst = 0;
    let calculatedSgst = 0;

    if (gstEnabled !== false) {
      calculatedGstAmount = (taxableAmount * gstPercentage) / 100;
      calculatedCgst = calculatedGstAmount / 2;
      calculatedSgst = calculatedGstAmount / 2;
    }

    // Calculate final total
    const calculatedTotalAmount = taxableAmount + calculatedGstAmount;

    logger.info('Financial calculations completed', {
      subtotal: calculatedSubtotal,
      discountAmount: calculatedDiscountAmount,
      taxableAmount,
      gstPercentage,
      gstAmount: calculatedGstAmount,
      cgst: calculatedCgst,
      sgst: calculatedSgst,
      totalAmount: calculatedTotalAmount
    });

    // Find or create buyer
    let buyer = await WholesaleBuyer.findOne({
      mobile: buyerContact,
      organizationId
    }).session(session);

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
        isTrusted: false
      }], { session });
      buyer = buyer[0];
      logger.info('New buyer created', { buyerId: buyer._id, name: buyerName });
    }

    // ✅ STEP 3: Deduct stock (main + reserved)
    for (const item of items) {
      const product = await Product.findOne({
        design: item.design,
        organizationId
      }).session(session);

      const colorVariant = product.colors.find(c => c.color === item.color);
      const sizeIndex = colorVariant.sizes.findIndex(s => s.size === item.size);

      const mainStock = colorVariant.sizes[sizeIndex].currentStock;
      const reservedStock = colorVariant.sizes[sizeIndex].reservedStock || 0;

      if (item.quantity <= mainStock) {
        // Sufficient in main
        colorVariant.sizes[sizeIndex].currentStock -= item.quantity;
      } else {
        // Need to borrow from reserved
        const borrowAmount = item.quantity - mainStock;
        colorVariant.sizes[sizeIndex].currentStock = 0;
        colorVariant.sizes[sizeIndex].reservedStock -= borrowAmount;

        // Log transfer
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

        console.log(`✅ Borrowed ${borrowAmount} from Reserved for ${item.design}-${item.color}-${item.size}`);
      }

      await product.save({ session });
    }

    // Generate challan number
    const challanNumber = await generateChallanNumber(businessName || buyerName, organizationId, session);

    const amountDue = calculatedTotalAmount - (amountPaid || 0);
    const paymentStatus = amountDue === 0 ? 'Paid' : (amountPaid > 0 ? 'Partial' : 'Pending');

    // ✅ STEP 4: Create order with RECALCULATED values
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
      subtotalAmount: calculatedSubtotal,
      discountType: discountType || 'none',
      discountValue: discountValue || 0,
      discountAmount: calculatedDiscountAmount,
      gstEnabled: gstEnabled !== false,
      gstPercentage: gstPercentage,           // STORE THE PERCENTAGE USED
      gstAmount: calculatedGstAmount,         // ✅ BACKEND CALCULATED
      cgst: calculatedCgst,                   // ✅ BACKEND CALCULATED
      sgst: calculatedSgst,                   // ✅ BACKEND CALCULATED
      totalAmount: calculatedTotalAmount,     // ✅ BACKEND CALCULATED
      amountPaid: amountPaid || 0,
      amountDue,
      paymentStatus,
      paymentMethod: paymentMethod || 'Cash',
      orderStatus: 'Delivered',
      notes: notes || '',
      fulfillmentType: fulfillmentType || 'warehouse',
      organizationId,
      createdBy: {
        userId: req.user._id,
        userName: req.user.name || req.user.email,
        userRole: req.user.role
      },
      createdAt: new Date()
    }], { session });

    // Update buyer's total due
    buyer.totalDue = (buyer.totalDue || 0) + amountDue;
    buyer.totalOrders = (buyer.totalOrders || 0) + 1;
    buyer.lastOrderDate = new Date();
    await buyer.save({ session });

    await session.commitTransaction();

    logger.info('Wholesale order created with reserved borrow', {
      orderId: order[0]._id,
      challanNumber,
      totalAmount: calculatedTotalAmount,
      gstPercentage,
      gstAmount: calculatedGstAmount
    });

    res.status(201).json(order[0]);

  } catch (error) {
    await session.abortTransaction();
    logger.error('Wholesale order with reserved borrow failed', { error: error.message });
    res.status(500).json({
      code: 'ORDER_CREATION_FAILED',
      message: 'Failed to create order',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// Get buyer monthly purchase history
const getBuyerMonthlyHistory = async (req, res) => {
  try {
    const { id } = req.params; // buyer ID
    const organizationId = req.user.organizationId;

    // Validate buyer exists
    const buyer = await WholesaleBuyer.findOne({ _id: id, organizationId });
    if (!buyer) {
      return res.status(404).json({
        code: 'BUYER_NOT_FOUND',
        message: 'Buyer not found'
      });
    }

    // Get all orders for this buyer
    const orders = await WholesaleOrder.find({
      buyerId: id,
      organizationId
    })
      .select('challanNumber orderDate createdAt items totalAmount amountPaid amountDue')
      .sort({ createdAt: -1 })
      .lean();

    if (!orders || orders.length === 0) {
      return res.json({
        success: true,
        monthlyData: []
      });
    }

    // Group orders by month and year
    const monthlyMap = {};

    orders.forEach(order => {
      const orderDate = new Date(order.orderDate || order.createdAt);
      const month = orderDate.toLocaleString('en-US', { month: 'long' });
      const year = orderDate.getFullYear();
      const key = `${month}-${year}`;

      if (!monthlyMap[key]) {
        monthlyMap[key] = {
          month,
          year,
          totalUnits: 0,
          totalAmount: 0,
          totalPaid: 0,
          totalOrders: 0,
          billGenerated: false,
          orders: []
        };
      }

      // Calculate total units from order items
      const orderUnits = order.items.reduce((sum, item) => sum + (item.quantity || 0), 0);

      monthlyMap[key].totalUnits += orderUnits;
      monthlyMap[key].totalAmount += order.totalAmount || 0;
      monthlyMap[key].totalPaid += order.amountPaid || 0;
      monthlyMap[key].totalOrders += 1;

      // Check if order has a monthly bill (you might need to adjust this field name)
      // if (order.monthlyBillId || order.billGenerated) {
      //   monthlyMap[key].billGenerated = true;
      // }

      monthlyMap[key].orders.push({
        challanNumber: order.challanNumber,
        date: order.orderDate || order.createdAt,
        totalUnits: orderUnits,
        totalAmount: order.totalAmount || 0
      });
    });

    // Convert map to array and sort by date (newest first)
    const monthlyData = Object.values(monthlyMap).sort((a, b) => {
      const dateA = new Date(`${a.month} 1, ${a.year}`);
      const dateB = new Date(`${b.month} 1, ${b.year}`);
      return dateB - dateA; // Newest first
    });

    logger.info('Monthly history fetched successfully', {
      buyerId: id,
      monthsCount: monthlyData.length
    });

    res.json({
      success: true,
      monthlyData
    });

  } catch (error) {
    logger.error('Failed to fetch monthly history', {
      error: error.message,
      buyerId: req.params.id
    });
    res.status(500).json({
      code: 'FETCH_FAILED',
      message: 'Failed to fetch monthly history',
      error: error.message
    });
  }
};

// Delete a specific payment from order's payment history (Admin only)
const deleteOrderPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id, paymentIndex } = req.params; // Order ID and payment index
    const { organizationId } = req.user;

    // Find the order
    const order = await WholesaleOrder.findOne({ _id: id, organizationId }).session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ 
        code: 'ORDER_NOT_FOUND', 
        message: 'Order not found' 
      });
    }

    // Validate payment index
    const index = parseInt(paymentIndex);
    if (index < 0 || index >= order.paymentHistory.length) {
      await session.abortTransaction();
      return res.status(400).json({ 
        code: 'INVALID_INDEX', 
        message: 'Invalid payment index' 
      });
    }

    // Get the payment to be deleted
    const paymentToDelete = order.paymentHistory[index];
    const paymentAmount = paymentToDelete.amount || 0;

    // Remove payment from history
    order.paymentHistory.splice(index, 1);

    // Recalculate order financials
    order.amountPaid = order.paymentHistory.reduce((sum, p) => sum + (p.amount || 0), 0);
    order.amountDue = Math.max(0, order.totalAmount - order.amountPaid);

    // Update payment status
    if (order.amountDue === 0) {
      order.paymentStatus = 'Paid';
    } else if (order.amountPaid > 0) {
      order.paymentStatus = 'Partial';
    } else {
      order.paymentStatus = 'Pending';
    }

    await order.save({ session });

    // Update buyer's total due
    if (order.buyerId) {
      const buyer = await WholesaleBuyer.findById(order.buyerId).session(session);
      if (buyer) {
        buyer.totalDue = (buyer.totalDue || 0) + paymentAmount;
        buyer.totalPaid = Math.max(0, (buyer.totalPaid || 0) - paymentAmount);
        await buyer.save({ session });
      }
    }

    await session.commitTransaction();

    logger.info('Order payment deleted successfully', { 
      orderId: id, 
      paymentIndex: index, 
      paymentAmount, 
      deletedBy: req.user.email 
    });

    res.json({ 
      success: true, 
      message: 'Payment deleted successfully',
      order 
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Payment deletion failed', { error: error.message, orderId: req.params.id });
    res.status(500).json({ 
      code: 'DELETE_FAILED', 
      message: 'Failed to delete payment', 
      error: error.message 
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
  recordSmartPayment,
  getBulkPaymentHistory,
  updateBulkPayment,
  deleteBulkPayment,
  previewPaymentAllocation,
  getBuyerStats,
  sendChallanEmail,
  createOrderWithReservedBorrow,
  getBuyerMonthlyHistory,
  deleteOrderPayment
};
