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
const Subscription = require('../models/Subscription');
const TenantSettings = require('../models/TenantSettings');
const { syncOrderToTenant } = require('./syncController'); // Add this new controller
const supplierSyncController = require('./supplierSyncController');
const User = require('../models/User');
const { updateChallansAfterPayment } = require('./monthlyBillController');

/**
 * Proportionally deducts `amount` from reservedAllocations.
 * Takes from largest accounts first to minimize rounding errors.
 * Mutates sizeVariant.reservedAllocations in-place.
 */
const deductFromAllocationsProportionally = (sizeVariant, amountToDeduct) => {
  const allocations = sizeVariant.reservedAllocations;
  if (!allocations || allocations.length === 0) return;

  const totalAllocated = allocations.reduce((sum, a) => sum + (a.quantity || 0), 0);
  if (totalAllocated <= 0) return;

  let remaining = amountToDeduct;

  // Calculate proportional amounts
  const deductions = allocations.map(alloc => {
    if (alloc.quantity <= 0) return { accountName: alloc.accountName, deduct: 0 };
    const proportion = alloc.quantity / totalAllocated;
    const deduct = Math.min(Math.round(amountToDeduct * proportion), alloc.quantity);
    return { accountName: alloc.accountName, deduct };
  });

  // Apply deductions
  deductions.forEach(({ accountName, deduct }) => {
    const alloc = allocations.find(a => a.accountName === accountName);
    if (alloc && deduct > 0) {
      alloc.quantity -= deduct;
      remaining -= deduct;
    }
  });

  // Handle rounding remainder — take from largest remaining allocation
  if (remaining > 0) {
    const sorted = [...allocations]
      .filter(a => a.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity);

    for (const ref of sorted) {
      if (remaining <= 0) break;
      const alloc = allocations.find(a => a.accountName === ref.accountName);
      if (alloc && alloc.quantity > 0) {
        const take = Math.min(alloc.quantity, remaining);
        alloc.quantity -= take;
        remaining -= take;
      }
    }
  }

  console.log(`✅ Allocation deduction done. Remaining deduction: ${remaining} (should be 0)`);
};

// ✅ ADD THIS - Global flag to disable locked stock
const STOCK_LOCK_DISABLED = true;

const getAllOrders = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const {
      page = 1,
      limit = 15,
      search = '',
      paymentStatus = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      all,              // ✅ add this
    } = req.query;

    const query = { organizationId, deletedAt: null };

    if (search?.trim()) {
      query.$or = [
        { buyerName:     { $regex: search.trim(), $options: 'i' } },
        { businessName:  { $regex: search.trim(), $options: 'i' } },
        { buyerContact:  { $regex: search.trim(), $options: 'i' } },
        { challanNumber: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    if (paymentStatus !== 'all') {
      query.paymentStatus = { $regex: new RegExp(`^${paymentStatus}$`, 'i') };
    }

    // ✅ Dashboard calls with all=true — skip pagination, return everything
    if (all === 'true') {
      const orders = await WholesaleOrder.find(query)
        .populate('buyerId', 'name mobile businessName')
        .sort({ createdAt: -1 })
        .lean();
      return res.json({ orders, total: orders.length });
    }

    // existing paginated logic — unchanged below
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const [orders, total] = await Promise.all([
      WholesaleOrder.find(query)
        .populate('buyerId', 'name mobile businessName')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      WholesaleOrder.countDocuments(query)
    ]);

    res.json({
      orders,
      pagination: {
        total,
        page:       parseInt(page),
        limit:      parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
        hasNext:    parseInt(page) < Math.ceil(total / parseInt(limit)),
        hasPrev:    parseInt(page) > 1
      }
    });
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
          design: item.design, organizationId: organizationId 
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

              // ✅ ADD: Proportionally deduct from allocations
              deductFromAllocationsProportionally(
                colorVariant.sizes[sizeIndex],
                actualReservedDeduction
              );
            }

            // ✅ ADD markModified before save
            productRef.markModified('colors');

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

    // Calculate amount due
    const amountDue = calculatedTotalAmount - (amountPaid || 0);
    const paymentStatus = amountDue <= 0 ? 'Paid' : (amountPaid > 0 ? 'Partial' : 'Pending');

    // ✅ Generate challan number before creating order
    const challanNumber = await generateChallanNumber(
      businessName || buyerName,
      organizationId,
      session
    );

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

// ✅ NEW: Auto-sync to customer if they have a tenant account
try {
  const syncResult = await supplierSyncController.syncOrderToCustomer(
    order[0]._id,
    req.user.organizationId
  );
  
  if (syncResult.synced) {
    logger.info('✅ Order auto-synced to customer', {
      orderId: order[0]._id,
      customerTenantId: syncResult.customerTenantId,
      itemsCount: syncResult.itemsCount
    });
  } else {
    logger.info('ℹ️ Order not synced:', syncResult.reason);
  }
} catch (syncError) {
  // Don't fail the order creation if sync fails
  logger.warn('⚠️ Auto-sync failed (non-critical):', {
    orderId: order[0]._id,
    error: syncError.message
  });
}

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
    const cleanBusinessName = (businessName || '')
      .trim()                           // remove leading/trailing spaces
      .replace(/[^a-zA-Z0-9 ]/g, '')   // remove special characters
      .replace(/ /g, '_')              // spaces → underscores
      .toUpperCase()

    const query = WholesaleOrder.find(
      { businessName: businessName, organizationId, deletedAt: null },
      { challanNumber: 1 }
    ).lean();
    if (session) query.session(session);
    const existingOrders = await query;

    const usedNumbers = existingOrders
      .map(order => {
        const match = order.challanNumber.match(/(\d+)$/)
        return match ? parseInt(match[1], 10) : null
      })
      .filter(num => num !== null)
      .sort((a, b) => a - b)

    const maxSequence = usedNumbers.length > 0 ? Math.max(...usedNumbers) : 0
    const orderNumber = maxSequence + 1

    // ✅ Always produces BUSINESSNAME_01 format
    const challanNumber = `${cleanBusinessName}_${String(orderNumber).padStart(2, '0')}`

    return challanNumber
  } catch (error) {
    logger.error('Challan number generation failed', { error: error.message })
    return `CH${Date.now().toString().slice(-8)}`
  }
}

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
            design: newItem.design, organizationId: organizationId
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
          design: oldItem.design, organizationId: organizationId
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
          design: newItem.design, organizationId: organizationId,
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

// ✅ NEW: Sync edit to customer if order was previously synced (within 24hrs)
try {
  const syncResult = await supplierSyncController.syncOrderEdit(
    id,
    req.user.organizationId,
    req.body // Changes made
  );
  
  if (syncResult.synced) {
    logger.info('✅ Order edit synced to customer', {
      orderId: id,
      itemsCount: syncResult.itemsCount
    });
  } else {
    logger.info('ℹ️ Edit not synced:', syncResult.reason);
  }
} catch (syncError) {
  logger.warn('⚠️ Edit sync failed (non-critical):', {
    orderId: id,
    error: syncError.message
  });
}

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

// 🆕 UPDATE: Add 24-hour check to delete function
const deleteOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { organizationId, id: userId, name, email, role } = req.user;

    const order = await WholesaleOrder.findOne({
      _id: id,
      organizationId,
      deletedAt: null
    }).session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found or already deleted'
      });
    }

    // 🆕 NEW: Check 24-hour window for deletion
    const orderAge = Date.now() - new Date(order.createdAt).getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    if (orderAge > twentyFourHours) {
      await session.abortTransaction();
      return res.status(400).json({
        code: 'DELETE_WINDOW_EXPIRED',
        message: 'Cannot delete orders older than 24 hours',
        orderAge: Math.floor(orderAge / (60 * 60 * 1000)) + ' hours',
        maxAge: '24 hours'
      });
    }

    // Sync deletion to customer FIRST before stock restoration
    if (order.syncedToCustomer) {
      try {
        const syncResult = await supplierSyncController.syncOrderDelete(
          order._id,
          req.user.organizationId
        );
        
        if (syncResult.synced) {
          logger.info('Order deletion synced to customer', {
            orderId: order._id,
            receivingsDeleted: syncResult.receivingsDeleted
          });
        }
      } catch (syncError) {
        logger.warn('Delete sync failed (non-critical)', {
          orderId: order._id,
          error: syncError.message
        });
      }
    }

    // STEP 1: Restore stock to MAIN inventory
    if (order.fulfillmentType !== 'factory-direct') {
      for (const item of order.items) {
        const product = await Product.findOne({
          design: item.design,
          organizationId: organizationId
        }).session(session);

        if (product) {
          const colorVariant = product.colors.find(c => c.color === item.color);
          if (colorVariant) {
            const sizeIndex = colorVariant.sizes.findIndex(s => s.size === item.size);
            if (sizeIndex !== -1) {
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

    // STEP 3: Remove from monthly bills
    const bills = await MonthlyBill.find({
      organizationId,
      'orders.orderId': id
    }).session(session);

    for (const bill of bills) {
      bill.orders = bill.orders.filter(o => o.orderId.toString() !== id);
      
      const newSubtotal = bill.orders.reduce((sum, o) => sum + (o.subtotalAmount || 0), 0);
      const newGst = bill.orders.reduce((sum, o) => sum + (o.gstAmount || 0), 0);
      const newTotal = bill.orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      
      bill.financials.subtotalAmount = newSubtotal;
      bill.financials.gstAmount = newGst;
      bill.financials.totalAmount = newTotal;
      bill.financials.balanceDue = newTotal - (bill.financials.amountPaid || 0);
      
      await bill.save({ session });
    }

    // STEP 4: Soft delete the order
    order.deletedAt = new Date();
    order.deletedBy = userId;
    order.deletionReason = 'User initiated deletion';
    await order.save({ session });

    await session.commitTransaction();

    logger.info('Order soft deleted successfully', {
      orderId: id,
      deletedBy: name || email,
      stockRestored: order.fulfillmentType !== 'factory-direct',
      syncedToCustomer: order.syncedToCustomer || false
    });

    res.json({
      success: true,
      message: 'Order deleted successfully',
      stockRestored: order.fulfillmentType !== 'factory-direct',
      syncedToCustomer: order.syncedToCustomer || false
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Order deletion failed', {
      error: error.message,
      orderId: req.params.id
    });
    
    res.status(500).json({
      code: 'DELETE_FAILED',
      message: 'Failed to delete order',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// 🆕 NEW: Get sync status for an order
getOrderSyncStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { organizationId } = req.user;

    const order = await WholesaleOrder.findOne({
      _id: orderId,
      organizationId,
      deletedAt: null
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        syncStatus: order.syncStatus || 'none',
        syncedToCustomer: order.syncedToCustomer || false,
        customerTenantId: order.customerTenantId || null,
        syncAttempts: order.syncAttempts || 0,
        lastSyncAttempt: order.lastSyncAttempt || null,
        syncError: order.syncError || null
      }
    });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch sync status'
    });
  }
};

// Get pending payments
const getPendingPayments = async (req, res) => {
  try {
    const { organizationId } = req.user.organizationId;

    const orders = await WholesaleOrder.find({
      organizationId,
      amountDue: { $gt: 0 },
      deletedAt: null // ✅ EXCLUDE deleted orders
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
      error: error.message
    });
  }
};

// ✅ FIXED: Always show real order-based stats regardless of bill status
const getAllBuyers = async (req, res) => {
  try {
    const { organizationId } = req.user;

    // Fetch all buyers
    const buyers = await WholesaleBuyer.find({ organizationId })
      .select(
        'name mobile email businessName gstNumber address creditLimit isTrusted ' +
        'lastOrderDate customerTenantId syncEnabled lastSyncedAt ' +
        'totalOrders totalDue totalPaid totalSpent monthlyBills'
      )
      .lean()
      .sort({ lastOrderDate: -1 });

    // Compute real-time stats from WholesaleOrder — never from bill snapshots
    const enrichedBuyers = await Promise.all(
      buyers.map(async (buyer) => {
        // Get all active (non-deleted) orders for this buyer
        const orders = await WholesaleOrder.find({
          buyerId: buyer._id,
          organizationId,
          deletedAt: null,
        }).lean();

        // ✅ ALWAYS use order-based calculations
        // Bills are for invoicing only — they must not override display metrics
        const totalOrders = orders.length;
        const totalSpent  = orders.reduce((sum, o) => sum + o.totalAmount, 0);

        // When bills exist, trust bill balanceDue (covers PREV-ADJ too)
        // When no bills, fall back to order-based calculation
        let totalDue, totalPaid;

        if (buyer.monthlyBills && buyer.monthlyBills.length > 0) {
          // Fetch fresh bill values — don't trust cached monthlyBills array
          const activeBills = await MonthlyBill.find({
            organizationId,
            'buyer.id': buyer._id.toString()
          }).lean();

          totalDue  = Math.max(0, Math.round(
            activeBills.reduce((s, b) => s + (b.financials?.balanceDue || 0), 0) * 100
          ) / 100);
          totalPaid = Math.round(
            activeBills.reduce((s, b) => s + (b.financials?.amountPaid || 0), 0) * 100
          ) / 100;
        } else {
          totalPaid = orders.reduce((sum, o) => sum + o.amountPaid, 0);
          totalDue  = orders.reduce((sum, o) => sum + o.amountDue, 0);
        }

        const finalStats = {
          totalOrders,
          totalDue:   parseFloat(totalDue.toFixed(2)),
          totalPaid:  parseFloat(totalPaid.toFixed(2)),
          totalSpent: parseFloat(totalSpent.toFixed(2)),
          // hasBills derived from tracking array on buyer — no extra DB query needed
          hasBills: (buyer.monthlyBills?.length || 0) > 0,
        };

        // Silently heal stale cached values in DB (fire and forget)
        const needsUpdate =
          buyer.totalOrders !== finalStats.totalOrders ||
          Math.abs((buyer.totalDue   || 0) - finalStats.totalDue)   > 0.01 ||
          Math.abs((buyer.totalPaid  || 0) - finalStats.totalPaid)  > 0.01 ||
          Math.abs((buyer.totalSpent || 0) - finalStats.totalSpent) > 0.01;

        if (needsUpdate) {
          WholesaleBuyer.findByIdAndUpdate(buyer._id, {
            totalOrders: finalStats.totalOrders,
            totalDue:    finalStats.totalDue,
            totalPaid:   finalStats.totalPaid,
            totalSpent:  finalStats.totalSpent,
          }).catch((err) =>
            logger.error('Failed to auto-update buyer stats', {
              buyerId: buyer._id,
              error: err.message,
            })
          );
          logger.info('Auto-fixing stale buyer stats', {
            buyerId:   buyer._id,
            buyerName: buyer.name,
            old: { totalOrders: buyer.totalOrders, totalDue: buyer.totalDue },
            new: { totalOrders: finalStats.totalOrders, totalDue: finalStats.totalDue },
          });
        }

        return { ...buyer, ...finalStats };
      })
    );

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
    const { organizationId } = req.user.organizationId;

    const orders = await WholesaleOrder.find({
      buyerId: id,
      organizationId,
      deletedAt: null // ✅ EXCLUDE deleted orders
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json(orders);
  } catch (error) {
    logger.error('Failed to fetch buyer history', { error: error.message, buyerId: req.params.id });
    res.status(500).json({
      code: 'FETCH_FAILED',
      message: 'Failed to fetch buyer history',
      error: error.message
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
    const { businessName, buyerName } = req.body;
    const organizationId = req.user.organizationId;

    const challanNumber = await generateChallanNumber(businessName || buyerName, organizationId);
    res.json({ challanNumber });

  } catch (error) {
    logger.error('Failed to preview challan number', { error: error.message });
    res.status(500).json({ code: 'PREVIEW_FAILED', message: 'Failed to preview challan number' });
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
      deletedAt: null // ✅ EXCLUDE deleted orders
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
    const { id } = req.params;
    const { amount, paymentMethod, paymentDate, notes } = req.body;
    const organizationId = req.user.organizationId;

    if (!amount || amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        code: 'INVALID_AMOUNT',
        message: 'Invalid payment amount'
      });
    }

    const buyer = await WholesaleBuyer.findOne({ _id: id, organizationId }).session(session);

    if (!buyer) {
      await session.abortTransaction();
      return res.status(404).json({
        code: 'BUYER_NOT_FOUND',
        message: 'Buyer not found'
      });
    }

    let remainingAmount = parseFloat(amount);

    const paymentRecord = {
      amount        : parseFloat(amount),
      paymentDate   : paymentDate || new Date(),
      paymentMethod : paymentMethod || 'Cash',
      notes         : notes || '',
      recordedBy    : req.user.email || req.user.username,
      recordedByRole: req.user.role
    };

    // ── STEP 1: Check if bills exist ────────────────────────────────────────
    const bills = await MonthlyBill.find({
      organizationId,
      'buyer.id': id,
      'financials.balanceDue': { $gt: 0 }
    })
      .sort({ 'billingPeriod.year': 1, 'billingPeriod.month': 1 })
      .session(session);

    // ════════════════════════════════════════════════════════════════════════
    // PATH A — BILL-BASED ALLOCATION
    // ════════════════════════════════════════════════════════════════════════
    if (bills.length > 0) {
      logger.info('Bills found - allocating payment to bills', {
        buyerId: id, billsCount: bills.length, amount
      });

      const billsAffected = [];

      for (const bill of bills) {
        if (remainingAmount <= 0) break;

        const amountToAllocate = Math.min(remainingAmount, bill.financials.balanceDue);

        bill.financials.amountPaid += amountToAllocate;
        bill.financials.balanceDue  = Math.max(0, bill.financials.balanceDue - amountToAllocate);

        if (bill.financials.balanceDue === 0) {
          bill.status = 'paid';
          bill.paidAt = new Date();
        } else {
          bill.status = 'partial';
        }

        bill.paymentHistory.push({
          ...paymentRecord,
          amount: amountToAllocate,
          notes : notes || 'Payment allocation'
        });

        await bill.save({ session });

        // Sync to buyer.monthlyBills tracking array
        const buyerBillIndex = buyer.monthlyBills.findIndex(
          b => b.billId.toString() === bill._id.toString()
        );
        if (buyerBillIndex !== -1) {
          buyer.monthlyBills[buyerBillIndex].amountPaid = bill.financials.amountPaid;
          buyer.monthlyBills[buyerBillIndex].balanceDue = bill.financials.balanceDue;
          buyer.monthlyBills[buyerBillIndex].status     = bill.status;
        }

        billsAffected.push({
          billId         : bill._id,
          billNumber     : bill.billNumber,
          month          : bill.billingPeriod.month,
          year           : bill.billingPeriod.year,
          amountAllocated: amountToAllocate,
          newBalance     : bill.financials.balanceDue
        });

        remainingAmount -= amountToAllocate;

        logger.info('Payment allocated to bill', {
          billId    : bill._id,
          billNumber: bill.billNumber,
          allocated : amountToAllocate,
          newBalance: bill.financials.balanceDue
        });

        // Update individual challan/order payment status using CORRECT ratio
        try {
          const challanUpdateResult = await updateChallansAfterPayment(bill, session);
          logger.info('Challans updated for bill', {
            billNumber: bill.billNumber,
            ...challanUpdateResult
          });
        } catch (challanError) {
          logger.error('Failed to update challans, continuing', {
            billNumber: bill.billNumber,
            error     : challanError.message
          });
        }
      }

      // ── Handle excess → save as advance ───────────────────────────────────
      const excessAmount = Math.round(remainingAmount * 100) / 100;
      if (excessAmount > 0) {
        buyer.advancePayments.push({
          amount        : excessAmount,
          paymentDate   : paymentRecord.paymentDate,
          paymentMethod : paymentRecord.paymentMethod,
          forMonth      : null,
          forYear       : null,
          status        : 'pending-allocation',
          notes         : `Excess from bulk payment. Original: ₹${parseFloat(amount).toLocaleString('en-IN')}. ${notes || ''}`.trim(),
          recordedBy    : paymentRecord.recordedBy,
          recordedByRole: paymentRecord.recordedByRole
        });

        logger.info('Excess payment saved as advance (bill path)', {
          buyerId: id, excessAmount, originalAmount: amount
        });
      }

      // Recalculate buyer totals from fresh bill values (most accurate)
      const freshBills = await MonthlyBill.find({
        organizationId,
        'buyer.id': id
      }).session(session).lean();

      buyer.totalDue  = Math.max(0, Math.round(
        freshBills.reduce((s, b) => s + (b.financials?.balanceDue || 0), 0) * 100
      ) / 100);
      buyer.totalPaid = Math.round(
        freshBills.reduce((s, b) => s + (b.financials?.amountPaid || 0), 0) * 100
      ) / 100;

      await buyer.save({ session });
      await session.commitTransaction();

      const allocatedAmount = parseFloat(amount) - (excessAmount > 0 ? excessAmount : 0);

      return res.json({
        success: true,
        message: excessAmount > 0
          ? `Payment recorded. ₹${excessAmount.toLocaleString('en-IN')} saved as advance`
          : 'Payment recorded and allocated to bills',
        data: {
          amountReceived      : parseFloat(amount),
          amountAllocated     : Math.round(allocatedAmount * 100) / 100,
          excessAmount        : excessAmount,
          excessSavedAsAdvance: excessAmount > 0,
          warning             : excessAmount > 0
            ? `₹${excessAmount.toLocaleString('en-IN')} saved as advance — will auto-apply to next bill`
            : null,
          billsAffected,
          newTotalDue         : buyer.totalDue
        }
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // PATH B — ORDER-BASED ALLOCATION (no bills)
    // ════════════════════════════════════════════════════════════════════════
    logger.info('No bills found - using order-based payment', { buyerId: id, amount });

    const orders = await WholesaleOrder.find({
      buyerId    : buyer._id,
      organizationId,
      amountDue  : { $gt: 0 },
      deletedAt  : null                          // exclude deleted orders
    })
      .sort({ createdAt: 1 })
      .session(session);

    if (orders.length === 0) {
      // No orders either → entire amount is advance
      const excessAmount = Math.round(parseFloat(amount) * 100) / 100;

      buyer.advancePayments.push({
        amount        : excessAmount,
        paymentDate   : paymentRecord.paymentDate,
        paymentMethod : paymentRecord.paymentMethod,
        forMonth      : null,
        forYear       : null,
        status        : 'pending-allocation',
        notes         : `Full advance — no pending orders/bills at time of recording. ${notes || ''}`.trim(),
        recordedBy    : paymentRecord.recordedBy,
        recordedByRole: paymentRecord.recordedByRole
      });

      await buyer.save({ session });
      await session.commitTransaction();

      logger.info('No pending orders/bills — full amount saved as advance', {
        buyerId: id, excessAmount
      });

      return res.json({
        success: true,
        message: `No pending dues found. ₹${excessAmount.toLocaleString('en-IN')} saved as advance payment`,
        data: {
          amountReceived      : parseFloat(amount),
          amountAllocated     : 0,
          excessAmount,
          excessSavedAsAdvance: true,
          warning             : `Full amount saved as advance — will auto-apply to next bill`,
          ordersAffected      : [],
          newTotalDue         : buyer.totalDue
        }
      });
    }

    const ordersAffected = [];

    for (const order of orders) {
      if (remainingAmount <= 0) break;

      const previousDue      = order.amountDue;
      const amountToAllocate = Math.min(remainingAmount, order.amountDue);

      order.amountPaid += amountToAllocate;
      order.amountDue   = Math.max(0, order.amountDue - amountToAllocate);

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
        orderId        : order._id,
        challanNumber  : order.challanNumber,
        amountAllocated: amountToAllocate,
        previousDue,
        newDue         : order.amountDue
      });

      remainingAmount -= amountToAllocate;
    }

    // Track in bulkPayments
    buyer.bulkPayments.push({
      ...paymentRecord,
      ordersAffected
    });

    // ── Handle excess → save as advance ───────────────────────────────────
    const excessAmount = Math.round(remainingAmount * 100) / 100;
    if (excessAmount > 0) {
      buyer.advancePayments.push({
        amount        : excessAmount,
        paymentDate   : paymentRecord.paymentDate,
        paymentMethod : paymentRecord.paymentMethod,
        forMonth      : null,
        forYear       : null,
        status        : 'pending-allocation',
        notes         : `Excess from bulk payment. Original: ₹${parseFloat(amount).toLocaleString('en-IN')}. ${notes || ''}`.trim(),
        recordedBy    : paymentRecord.recordedBy,
        recordedByRole: paymentRecord.recordedByRole
      });

      logger.info('Excess payment saved as advance (order path)', {
        buyerId: id, excessAmount, originalAmount: amount
      });
    }

    // Recalculate buyer totals from fresh order values
    const freshOrders = await WholesaleOrder.find({
      buyerId: buyer._id,
      organizationId,
      deletedAt: null
    }).session(session).lean();

    buyer.totalDue  = Math.max(0, Math.round(
      freshOrders.reduce((s, o) => s + (o.amountDue  || 0), 0) * 100
    ) / 100);
    buyer.totalPaid = Math.round(
      freshOrders.reduce((s, o) => s + (o.amountPaid || 0), 0) * 100
    ) / 100;

    await buyer.save({ session });
    await session.commitTransaction();

    const allocatedAmount = parseFloat(amount) - excessAmount;

    return res.json({
      success: true,
      message: excessAmount > 0
        ? `Payment recorded. ₹${excessAmount.toLocaleString('en-IN')} saved as advance`
        : 'Payment recorded and allocated to orders',
      data: {
        amountReceived      : parseFloat(amount),
        amountAllocated     : Math.round(allocatedAmount * 100) / 100,
        excessAmount,
        excessSavedAsAdvance: excessAmount > 0,
        warning             : excessAmount > 0
          ? `₹${excessAmount.toLocaleString('en-IN')} saved as advance — will auto-apply to next bill`
          : null,
        ordersAffected,
        newTotalDue         : buyer.totalDue
      }
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Smart payment recording failed', {
      error  : error.message,
      buyerId: req.params.id
    });
    res.status(500).json({
      code   : 'PAYMENT_FAILED',
      message: 'Failed to record payment',
      error  : error.message
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
    const { id } = req.params;
    const { amount } = req.body;
    const organizationId = req.user.organizationId;

    if (!amount || amount <= 0)
      return res.status(400).json({ code: 'INVALID_AMOUNT', message: 'Amount must be greater than 0' });

    const buyer = await WholesaleBuyer.findOne({ _id: id, organizationId });
    if (!buyer)
      return res.status(404).json({ code: 'BUYER_NOT_FOUND', message: 'Buyer not found' });

    let remainingAmount = parseFloat(amount);

    // ── STEP 1: Check if bills exist (mirror recordSmartPayment exactly) ──────
    const bills = await MonthlyBill.find({
      organizationId,
      'buyer.id': id,
      'financials.balanceDue': { $gt: 0 }
    })
      .sort({ 'billingPeriod.year': 1, 'billingPeriod.month': 1 })
      .lean();

    if (bills.length > 0) {
      // ── BILL-BASED PREVIEW ──────────────────────────────────────────────────
      const billAllocation = [];

      for (const bill of bills) {
        if (remainingAmount <= 0) break;

        const amountToAllocate = Math.min(remainingAmount, bill.financials.balanceDue);
        const newBalance = bill.financials.balanceDue - amountToAllocate;

        // ── Challan-level breakdown with CORRECT ratio (PREV-ADJ fix) ──────
        const realChallans = (bill.challans || []).filter(c => c.challanId);
        const realChallansTotal = realChallans.reduce((s, c) => s + (c.totalAmount || 0), 0);
        const projectedBillPaid = bill.financials.amountPaid + amountToAllocate;
        const paymentForReal = Math.min(projectedBillPaid, realChallansTotal);
        const correctRatio = realChallansTotal > 0 ? paymentForReal / realChallansTotal : 0;

        const challanBreakdown = realChallans.map(c => {
          const challanPaid = Math.min(
            Math.round((c.totalAmount || 0) * correctRatio * 100) / 100,
            c.totalAmount || 0
          );
          return {
            challanNumber: c.challanNumber,
            challanTotal: c.totalAmount,
            amountAllocated: challanPaid,
            newDue: Math.max(0, (c.totalAmount || 0) - challanPaid)
          };
        });

        billAllocation.push({
          billId: bill._id,
          billNumber: bill.billNumber,
          month: bill.billingPeriod?.month,
          year: bill.billingPeriod?.year,
          currentBalance: bill.financials.balanceDue,
          amountToAllocate,
          newBalance,
          status: newBalance === 0 ? 'FULLY_PAID' : 'PARTIALLY_PAID',
          challanBreakdown,
          hasPrevAdj: (bill.challans || []).some(c => c.challanNumber === 'PREV-ADJ'),
          prevAdjAmount: (bill.challans || [])
            .filter(c => c.challanNumber === 'PREV-ADJ')
            .reduce((s, c) => s + (c.totalAmount || 0), 0)
        });

        remainingAmount -= amountToAllocate;
      }

      return res.json({
        success: true,
        data: {
          mode: 'bill',                          // ← tells frontend which mode
          buyerName: buyer.name,
          totalDue: buyer.totalDue,
          amountReceived: parseFloat(amount),
          billAllocation,
          allocation: [],                        // empty for backward compat
          remainingDue: Math.max(0, buyer.totalDue - parseFloat(amount)),
          excessAmount: remainingAmount > 0 ? remainingAmount : 0
        }
      });
    }

    // ── STEP 2: No bills — order-based preview ────────────────────────────────
    const pendingOrders = await WholesaleOrder.find({
      buyerId: buyer._id,
      organizationId,
      amountDue: { $gt: 0 },
      deletedAt: null                            // ← deleted order fix
    })
      .sort({ createdAt: 1 })
      .select('challanNumber createdAt amountDue totalAmount amountPaid items')
      .lean();

    if (pendingOrders.length === 0)
      return res.status(400).json({ code: 'NO_PENDING_ORDERS', message: 'No pending orders found' });

    const allocation = [];
    for (const order of pendingOrders) {
      if (remainingAmount <= 0) break;
      const amountToAllocate = Math.min(remainingAmount, order.amountDue);
      const newDue = order.amountDue - amountToAllocate;
      allocation.push({
        orderId: order._id,
        challanNumber: order.challanNumber,
        orderDate: order.createdAt,
        currentDue: order.amountDue,
        amountToAllocate,
        newDue,
        status: newDue === 0 ? 'FULLY_PAID' : 'PARTIALLY_PAID',
        itemsCount: order.items?.length || 0
      });
      remainingAmount -= amountToAllocate;
    }

    return res.json({
      success: true,
      data: {
        mode: 'order',                           // ← tells frontend which mode
        buyerName: buyer.name,
        totalDue: buyer.totalDue,
        amountReceived: parseFloat(amount),
        billAllocation: [],                      // empty for backward compat
        allocation,
        remainingDue: Math.max(0, buyer.totalDue - parseFloat(amount)),
        excessAmount: remainingAmount > 0 ? remainingAmount : 0
      }
    });

  } catch (error) {
    logger.error('Payment preview failed', { error: error.message, buyerId: req.params.id });
    res.status(500).json({ code: 'PREVIEW_FAILED', message: 'Failed to preview payment allocation', error: error.message });
  }
};

// Get buyer statistics with accurate totals (EXCLUDING DELETED ORDERS)
const getBuyerStats = async (req, res) => {
  try {
    const { organizationId } = req.user;
    
    // Get all buyers
    const buyers = await WholesaleBuyer.find({ organizationId }).lean();
    
    // Calculate FRESH stats from actual orders
    const orders = await WholesaleOrder.find({
      organizationId,
      deletedAt: null  // Exclude deleted orders
    }).lean();

    // Calculate totals
    const totalOutstanding = orders.reduce((sum, o) => sum + (o.amountDue || 0), 0);
    const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const buyersWithDue = new Set(
      orders.filter(o => o.amountDue > 0).map(o => o.buyerId.toString())
    ).size;

    const stats = {
      totalBuyers: buyers.length,
      buyersWithDue: buyersWithDue,
      totalOutstanding: parseFloat(totalOutstanding.toFixed(2)),
      totalRevenue: parseFloat(totalRevenue.toFixed(2))
    };
    
    res.json(stats);
  } catch (error) {
    logger.error('Failed to fetch buyer stats:', { error: error.message });
    res.status(500).json({
      code: 'FETCH_FAILED',
      message: 'Failed to fetch buyer stats',
      error: error.message,
    });
  }
};

const createOrderWithReservedBorrow = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { borrowItems, ...orderData } = req.body;
    const { organizationId, id: userId } = req.user;
    const AllocationChange = require('../models/AllocationChange');

    logger.info('Creating order with reserved borrow (proportional split)', { 
      borrowItemsCount: borrowItems?.length,
      organizationId 
    });

    // ========================================
    // STEP 1: Emergency Borrow (Proportional Split)
    // ========================================
    const allocationChanges = [];
    const transferLogs = [];

    if (borrowItems && borrowItems.length > 0) {
      const settings = await Settings.findOne({ organizationId }).session(session);
      const defaultAccountName = settings?.marketplaceAccounts?.find(acc => acc.isDefault)?.accountName || 'Flipkart';

      for (const item of borrowItems) {
        const { design, color, size, quantity: borrowQty } = item;

        const product = await Product.findOne({ design, organizationId }).session(session);
        if (!product) {
          await session.abortTransaction();
          return res.status(404).json({
            code: 'PRODUCT_NOT_FOUND',
            message: `Product ${design} not found`
          });
        }

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

        // Get allocated accounts
        const allocatedAccounts = (sizeVariant.reservedAllocations || [])
          .filter(alloc => alloc.quantity > 0)
          .map(alloc => ({
            accountName: alloc.accountName,
            quantity: alloc.quantity,
            isDefault: alloc.accountName === defaultAccountName
          }));

        if (allocatedAccounts.length === 0) {
          await session.abortTransaction();
          return res.status(400).json({
            code: 'NO_ALLOCATED_STOCK',
            message: `No allocated stock found for ${design}-${color}-${size}`
          });
        }

        const totalAllocated = allocatedAccounts.reduce((sum, acc) => sum + acc.quantity, 0);

        if (totalAllocated < borrowQty) {
          await session.abortTransaction();
          return res.status(400).json({
            code: 'INSUFFICIENT_ALLOCATED_STOCK',
            message: `Insufficient allocated stock. Available: ${totalAllocated}, Need: ${borrowQty}`,
            available: totalAllocated,
            needed: borrowQty
          });
        }

        // ✅ PROPORTIONAL SPLIT (FIXED)
        let remainingToBorrow = borrowQty;
        const borrowBreakdown = [];

        // Calculate initial proportional amounts
        allocatedAccounts.forEach(account => {
          if (remainingToBorrow > 0) {
            const proportion = account.quantity / totalAllocated;
            // ✅ Use Math.round instead of Math.floor
            let borrowFromThis = Math.round(borrowQty * proportion);
            
            // Make sure we don't exceed available or remaining
            borrowFromThis = Math.min(borrowFromThis, account.quantity, remainingToBorrow);

            if (borrowFromThis > 0) {
              borrowBreakdown.push({
                accountName: account.accountName,
                borrowAmount: borrowFromThis,
                isDefault: account.isDefault
              });
              remainingToBorrow -= borrowFromThis;
            }
          }
        });

        // ✅ Handle remainder - give to default account first
        if (remainingToBorrow > 0) {
          const defaultAccount = borrowBreakdown.find(b => b.isDefault);
          if (defaultAccount) {
            const defaultAlloc = allocatedAccounts.find(a => a.accountName === defaultAccount.accountName);
            const defaultAvailable = defaultAlloc.quantity - defaultAccount.borrowAmount;

            if (defaultAvailable >= remainingToBorrow) {
              defaultAccount.borrowAmount += remainingToBorrow;
              remainingToBorrow = 0;
            }
          }

          // If still remaining, distribute across all accounts
          if (remainingToBorrow > 0) {
            for (const breakdown of borrowBreakdown) {
              if (remainingToBorrow === 0) break;
              const account = allocatedAccounts.find(a => a.accountName === breakdown.accountName);
              const canTakeMore = account.quantity - breakdown.borrowAmount;

              if (canTakeMore > 0) {
                const takeFromThis = Math.min(canTakeMore, remainingToBorrow);
                breakdown.borrowAmount += takeFromThis;
                remainingToBorrow -= takeFromThis;
              }
            }
          }
        }

        // ✅ FAILSAFE: If STILL remaining, use first available account
        if (remainingToBorrow > 0) {
          logger.warn('Remainder still exists after distribution, using failsafe', { 
            remainingToBorrow,
            borrowQty,
            allocatedAccounts: allocatedAccounts.length 
          });
          
          for (const account of allocatedAccounts) {
            if (remainingToBorrow === 0) break;
            
            const existingBorrow = borrowBreakdown.find(b => b.accountName === account.accountName);
            const alreadyBorrowing = existingBorrow?.borrowAmount || 0;
            const canTakeMore = account.quantity - alreadyBorrowing;
            
            if (canTakeMore > 0) {
              const takeFromThis = Math.min(canTakeMore, remainingToBorrow);
              
              if (existingBorrow) {
                existingBorrow.borrowAmount += takeFromThis;
              } else {
                borrowBreakdown.push({
                  accountName: account.accountName,
                  borrowAmount: takeFromThis,
                  isDefault: account.isDefault
                });
              }
              
              remainingToBorrow -= takeFromThis;
            }
          }
        }

        // ✅ VALIDATION: Ensure we borrowed everything
        if (remainingToBorrow > 0) {
          await session.abortTransaction();
          return res.status(500).json({
            code: 'BORROW_ALLOCATION_FAILED',
            message: `Failed to allocate borrow amount. Still need ${remainingToBorrow} units`,
            borrowQty,
            allocated: borrowQty - remainingToBorrow,
            remaining: remainingToBorrow
          });
        }

        logger.info('Borrow breakdown (proportional)', { 
          design, color, size,
          breakdown: borrowBreakdown.map(b => `${b.accountName}:${b.borrowAmount}`).join(', ')
        });

        // ✅ Apply borrowing to each account
        for (const breakdown of borrowBreakdown) {
          const alloc = sizeVariant.reservedAllocations?.find(
            a => a.accountName === breakdown.accountName
          );
          if (alloc) {
            alloc.quantity -= breakdown.borrowAmount;
            console.log(`✅ Deducted ${breakdown.borrowAmount} from account: ${breakdown.accountName}`);
          }
        }

        // ✅ Capture BEFORE values
        const mainStockBefore = sizeVariant.currentStock || 0;
        const reservedStockBefore = (sizeVariant.reservedStock || 0) + borrowQty; // +borrowQty because we subtract below

        // ✅ FIX: Move reserved → main
        sizeVariant.reservedStock = Math.max(0, (sizeVariant.reservedStock || 0) - borrowQty);
        sizeVariant.currentStock = (sizeVariant.currentStock || 0) + borrowQty; // ✅ THIS LINE WAS MISSING

        console.log(`✅ Reserved stock after borrow: ${sizeVariant.reservedStock}`);
        console.log(`✅ Main stock after borrow: ${sizeVariant.currentStock}`);

        product.markModified('colors');
        await product.save({ session });

        transferLogs.push({
          design,
          color,
          size,
          quantity: borrowQty,
          type: 'emergencyborrow',
          from: 'reserved',
          to: 'main',
          mainStockBefore,       // ✅ FIXED: was `sizeVariant.currentStock - totalBorrowed` (undefined)
          reservedStockBefore,   // ✅ FIXED: was `sizeVariant.reservedStock + totalBorrowed` (undefined)
          mainStockAfter: sizeVariant.currentStock,
          reservedStockAfter: sizeVariant.reservedStock,
          performedBy: userId,
          notes: `Emergency borrow: ${borrowBreakdown.map(b => `${b.accountName}(${b.borrowAmount})`).join(', ')}`,
          organizationId: organizationId
        });
      }

      // Bulk insert logs
      if (allocationChanges.length > 0) {
        await AllocationChange.insertMany(allocationChanges, { session });
        logger.info('Allocation changes logged', { count: allocationChanges.length });
      }

      if (transferLogs.length > 0) {
        await Transfer.insertMany(transferLogs, { session });
        logger.info('Transfer logs created', { count: transferLogs.length });
      }
    }

    // ========================================
    // STEP 2: Create the Wholesale Order
    // ========================================
    
    const {
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
      gstPercentage,
      gstAmount,
      cgst,
      sgst,
      totalAmount,
      amountPaid,
      paymentMethod,
      notes,
      fulfillmentType
    } = orderData;

    // Validation
    if (!buyerContact || !items || items.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        code: 'INVALID_DATA',
        message: 'Buyer contact and items are required'
      });
    }

    // Find or create buyer
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
        isTrusted: false
      }], { session });
      buyer = buyer[0];
    }

    // Deduct stock from main inventory (borrowed stock is already there)
    for (const item of items) {
      const product = await Product.findOne({ design: item.design, organizationId }).session(session);
      if (!product) continue;

      const colorVariant = product.colors.find(c => c.color === item.color);
      if (!colorVariant) continue;

      const sizeIndex = colorVariant.sizes.findIndex(s => s.size === item.size);
      if (sizeIndex === -1) continue;

      // ✅ Safety guard — if borrow didn't run or was wrong, catch it cleanly
      const currentMain = colorVariant.sizes[sizeIndex].currentStock || 0;
      if (currentMain < item.quantity) {
        await session.abortTransaction();
        return res.status(400).json({
          code: 'STOCK_MISMATCH',
          message: `Stock mismatch for ${item.design}-${item.color}-${item.size}. Main stock: ${currentMain}, Ordered: ${item.quantity}. borrowItems may have incorrect quantities.`
        });
      }

      colorVariant.sizes[sizeIndex].currentStock -= item.quantity;
      product.markModified('colors'); // ✅ required for nested array
      await product.save({ session });
    }

    // Generate challan
    const challanNumber = await generateChallanNumber(businessName || buyerName, organizationId, session);

    const amountDue = totalAmount - (amountPaid || 0);
    const paymentStatus = amountDue === 0 ? 'Paid' : (amountPaid || 0) > 0 ? 'Partial' : 'Pending';

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
      discountAmount,
      gstEnabled: gstEnabled !== false,
      gstPercentage: gstPercentage || 5,
      gstAmount,
      cgst,
      sgst,
      totalAmount,
      amountPaid: amountPaid || 0,
      amountDue,
      paymentStatus,
      paymentMethod: paymentMethod || 'Cash',
      orderStatus: 'Delivered',
      notes: notes || '',
      fulfillmentType: fulfillmentType || 'warehouse',
      organizationId,
      createdBy: {
        userId: req.user.id,
        userName: req.user.name || req.user.email,
        userRole: req.user.role
      },
      createdAt: new Date()
    }], { session });

    // Update buyer
    buyer.totalDue = (buyer.totalDue || 0) + amountDue;
    buyer.totalOrders = (buyer.totalOrders || 0) + 1;
    buyer.lastOrderDate = new Date();
    await buyer.save({ session });

    // ✅ AFTER — mirrors createOrder exactly
    await session.commitTransaction();
    logger.info('Order created with proportional emergency borrow', {
      orderId: order[0].id,
      challanNumber,
      itemsBorrowed: borrowItems?.length || 0,
      allocationChanges: allocationChanges.length,
      transferLogs: transferLogs.length
    });

    // ✅ FIX: Auto-sync to customer — respects buyer.syncPreference (auto/manual)
    // This was the missing piece causing syncStatus to stay 'none' (shown as manual)
    try {
      const syncResult = await supplierSyncController.syncOrderToCustomer(
        order[0].id,
        req.user.organizationId
      );
      if (syncResult.synced) {
        logger.info('Order auto-synced to customer (reserved borrow)', {
          orderId: order[0].id,
          customerTenantId: syncResult.customerTenantId,
          itemsCount: syncResult.itemsCount
        });
      } else {
        logger.info('Order not synced (reserved borrow)', syncResult.reason);
      }
    } catch (syncError) {
      // Non-critical — don't fail order creation if sync fails
      logger.warn('Auto-sync failed non-critical (reserved borrow)', {
        orderId: order[0].id,
        error: syncError.message
      });
    }

    // Auto-email challan (mirrors createOrder)
    try {
      const settings = await Settings.findOne({ organizationId });
      if (settings?.notifications?.autoEmailChallan && buyerEmail) {
        // Your existing email code here (same as in createOrder)
      }
    } catch (settingsError) {
      logger.warn('Failed to check auto-email setting (reserved borrow)', {
        error: settingsError.message
      });
    }

    // Check buyer notifications (mirrors createOrder)
    try {
      await checkBuyerNotifications(buyer.id);
    } catch (notifError) {
      logger.error('Notification check failed (reserved borrow)', {
        error: notifError.message,
        buyerId: buyer.id
      });
    }

    res.status(201).json(order[0]);

  } catch (error) {
    await session.abortTransaction();
    logger.error('Order with reserved borrow failed', { error: error.message, stack: error.stack });
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
      organizationId,
      deletedAt: null 
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

// ============================================
// TENANT LINKING FUNCTIONS
// ============================================

// ✅ UPDATED: Get all registered users for linking (match by phone)
const getTenantUsers = async (req, res) => {
  try {
    const { organizationId } = req.user;
    
    // ✅ Find ALL active users who are NOT in your organization
    // These are potential customers to link to
    const users = await User.find({
      organizationId: { $ne: organizationId }, // Not your organization
      isActive: true,
      role: 'admin' // Only admin users (organization owners)
    })
    .select('_id name email phone businessName companyName organizationId createdAt')
    .sort({ createdAt: -1 })
    .lean();
    
    logger.info('Fetched users for buyer linking', {
      requestedBy: organizationId,
      usersFound: users.length
    });
    
    res.json({
      success: true,
      data: users || []
    });
  } catch (error) {
    logger.error('Get tenant users failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
};

// ✅ UPDATED: Link buyer to customer organization (with phone matching)
const linkBuyerToTenant = async (req, res) => {
  try {
    const { buyerId } = req.params;
    const { customerTenantId } = req.body;
    const { organizationId } = req.user;

    // Find the buyer
    const buyer = await WholesaleBuyer.findOne({
      _id: buyerId,
      organizationId
    });

    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }

    // ✅ If linking (not unlinking)
    if (customerTenantId) {
      // Find the customer user
      const customerUser = await User.findById(customerTenantId);
      
      if (!customerUser) {
        return res.status(404).json({
          success: false,
          message: 'Customer user not found'
        });
      }

      // ✅ SECURITY CHECK: Verify phone numbers match
      const buyerPhone = buyer.mobile.replace(/\D/g, ''); // Remove non-digits
      const customerPhone = (customerUser.phone || '').replace(/\D/g, '');

      if (buyerPhone !== customerPhone) {
        return res.status(400).json({
          success: false,
          message: `Phone number mismatch. Buyer phone: ${buyer.mobile}, Customer phone: ${customerUser.phone}. They must match for linking.`
        });
      }

      // ✅ Update buyer with customer organization link
      const customerOrgId = customerUser.organizationId || customerUser._id;
      buyer.customerTenantId = customerOrgId;
      buyer.customerUserId = customerUser._id;
      buyer.isCustomer = true;
      buyer.syncEnabled = true;
      buyer.joinedAt = new Date();
      buyer.inviteStatus = 'accepted';

      logger.info('✅ Buyer linked to customer organization', {
        buyerId: buyer._id,
        buyerName: buyer.name,
        buyerPhone: buyer.mobile,
        customerUserId: customerUser._id,
        customerName: customerUser.name,
        customerOrganizationId: buyer.customerTenantId,
        customerPhone: customerUser.phone
      });

    } else {
      // ✅ Unlinking
      buyer.customerTenantId = null;
      buyer.customerUserId = null;
      buyer.isCustomer = false;
      buyer.syncEnabled = false;
      buyer.inviteStatus = 'not_invited';

      logger.info('🔓 Buyer unlinked from customer', {
        buyerId: buyer._id,
        buyerName: buyer.name
      });
    }

    buyer.updatedAt = new Date();
    await buyer.save();

    res.json({
      success: true,
      message: customerTenantId ? '✅ Buyer linked successfully! Orders will now auto-sync.' : 'Buyer unlinked successfully',
      data: buyer
    });

  } catch (error) {
    logger.error('Link buyer to tenant failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to link buyer',
      error: error.message
    });
  }
};

// Get buyer tenant info
const getBuyerTenantInfo = async (req, res) => {
  try {
    const { buyerId } = req.params;
    const { organizationId } = req.user;
    
    const buyer = await WholesaleBuyer.findOne({
      _id: buyerId,
      organizationId
    })
    .populate('customerTenantId', 'name email companyName')
    .lean();
    
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        customerTenantId: buyer.customerTenantId,
        syncEnabled: buyer.syncEnabled,
        lastSyncedAt: buyer.lastSyncedAt
      }
    });
  } catch (error) {
    logger.error('Get buyer tenant info failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch buyer tenant info',
      error: error.message
    });
  }
};

// ✅ NEW: Dedicated order-level stats endpoint
const getOrderStats = async (req, res) => {
  try {
    const { organizationId } = req.user;

    const orders = await WholesaleOrder.find({
      organizationId,
      deletedAt: null,
    }).lean();

    const totalRevenue   = orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
    const totalCollected = orders.reduce((s, o) => s + (o.amountPaid  || 0), 0);
    const totalDue       = orders.reduce((s, o) => s + (o.amountDue   || 0), 0);

    // case-insensitive match for both 'Pending'/'pending', 'Partial'/'partial', 'Paid'/'paid'
    const pendingCount = orders.filter(o => o.paymentStatus?.toLowerCase() === 'pending').length;
    const partialCount = orders.filter(o => o.paymentStatus?.toLowerCase() === 'partial').length;
    const paidCount    = orders.filter(o => o.paymentStatus?.toLowerCase() === 'paid').length;

    res.json({
      totalOrders:    orders.length,
      totalRevenue:   parseFloat(totalRevenue.toFixed(2)),
      totalCollected: parseFloat(totalCollected.toFixed(2)),
      totalDue:       parseFloat(totalDue.toFixed(2)),
      pendingCount,
      partialCount,
      paidCount,
    });
  } catch (error) {
    logger.error('Failed to fetch order stats', { error: error.message });
    res.status(500).json({
      code: 'FETCH_FAILED',
      message: 'Failed to fetch order stats',
      error: error.message,
    });
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
  deleteOrderPayment,
  getTenantUsers,
  linkBuyerToTenant,
  getBuyerTenantInfo,
  getOrderSyncStatus,
  getOrderStats
};