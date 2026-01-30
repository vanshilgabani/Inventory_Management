const MonthlyBill = require('../models/MonthlyBill');
const WholesaleOrder = require('../models/WholesaleOrder');
const WholesaleBuyer = require('../models/WholesaleBuyer');
const Settings = require('../models/Settings');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Get all monthly bills
const getAllBills = async (req, res) => {
  try {
    const { status, month, year, buyerId } = req.query;
    const organizationId = req.user.organizationId;

    const filter = { organizationId };

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (month && year) {
      filter['billingPeriod.month'] = month;
      filter['billingPeriod.year'] = parseInt(year);
    }

    if (buyerId) {
      filter['buyer.id'] = new mongoose.Types.ObjectId(buyerId);
    }

    const bills = await MonthlyBill.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: bills
    });
  } catch (error) {
    logger.error('Failed to fetch bills:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bills',
      error: error.message
    });
  }
};

// Get single bill
const getBillById = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const bill = await MonthlyBill.findOne({
      _id: id,
      organizationId
    });

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    res.json({
      success: true,
      data: bill
    });
  } catch (error) {
    logger.error('Failed to fetch bill:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bill',
      error: error.message
    });
  }
};

// UPDATED: Generate bill number WITHOUT gap-filling
const generateBillNumber = async (organizationId, customSequence = null, session) => {
  try {
    const settings = await Settings.findOne({ organizationId }).session(session);
    const prefix = settings?.billingSettings?.billNumberPrefix || 'VR';
    
    // Calculate current financial year (Apr-Mar cycle)
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-11
    const currentYear = today.getFullYear();
    const financialYear = (currentMonth >= 3) ? currentYear : currentYear - 1;
    
    // Initialize bill counter if not exists
    if (!settings.billCounter) {
      settings.billCounter = {
        currentFinancialYear: financialYear,
        currentSequence: 0,
        lastResetDate: new Date(),
      };
    }
    
    // Check if financial year changed (April 1st passed)
    if (settings.billCounter.currentFinancialYear !== financialYear) {
      // RESET counter for new FY
      settings.billCounter.currentFinancialYear = financialYear;
      settings.billCounter.currentSequence = 0;
      settings.billCounter.lastResetDate = new Date();
    }
    
    let billSequence;
    
    // If custom sequence provided (manual override), use it
    if (customSequence !== null && customSequence > 0) {
      billSequence = customSequence;
      logger.info('Using custom sequence number', { customSequence, financialYear });
    } else {
      // Get all existing bills for current financial year
      const existingBills = await MonthlyBill.find({
        organizationId,
        billNumber: new RegExp(`^${prefix}/${financialYear}/`), // Match: VR/2025/XX
      })
        .select('billNumber')
        .session(session)
        .lean();
      
      // Extract sequence numbers from existing bills
      const usedNumbers = existingBills
        .map(bill => {
          // Extract number from format: VR/2025/01 -> 01
          const match = bill.billNumber.match(/\/(\d+)$/);
          return match ? parseInt(match[1], 10) : null;
        })
        .filter(num => num !== null);
      
      // ✅ NEW LOGIC: Find HIGHEST number and add 1 (NO GAP-FILLING!)
      const maxSequence = usedNumbers.length > 0 
        ? Math.max(...usedNumbers) 
        : 0;
      
      billSequence = maxSequence + 1;
      
      logger.info('Bill number generated without gap-filling', {
        financialYear,
        maxSequence,
        billSequence,
        totalExistingBills: usedNumbers.length,
        usedNumbers: usedNumbers.sort((a, b) => a - b)
      });
    }
    
    // Update settings counter to highest number for reference
    settings.billCounter.currentSequence = Math.max(
      billSequence, 
      settings.billCounter.currentSequence
    );
    await settings.save({ session });
    
    // Format: VR/2025/01
    const formattedNumber = `${prefix}/${financialYear}/${String(billSequence).padStart(2, '0')}`;
    
    logger.info('Bill number generated', {
      financialYear,
      billSequence,
      formattedNumber,
      isCustom: customSequence !== null
    });
    
    return formattedNumber;
    
  } catch (error) {
    logger.error('Bill number generation failed', { error: error.message });
    throw error;
  }
};

/**
 * SMART ALGORITHM: Find best product combination to match target amount
 * Uses greedy approach with optimization
 */
const findBestProductCombination = (targetTaxableAmount, availablePrices, gstRate) => {
  // Sort prices ascending
  const prices = [...new Set(availablePrices)].sort((a, b) => a - b);
  
  let bestCombination = null;
  let smallestDifference = Infinity;
  
  logger.info('Finding product combination', {
    targetTaxable: targetTaxableAmount,
    availablePrices: prices
  });
  
  // STRATEGY 1: Try single price multiples (most common case)
  for (const price of prices) {
    // Try floor and ceil quantities
    const exactQty = targetTaxableAmount / price;
    const quantities = [Math.floor(exactQty), Math.ceil(exactQty)];
    
    for (const qty of quantities) {
      if (qty <= 0 || qty > 1000) continue; // Reasonable limits
      
      const amount = qty * price;
      const difference = Math.abs(targetTaxableAmount - amount);
      
      if (difference < smallestDifference) {
        smallestDifference = difference;
        bestCombination = {
          products: [{ price, quantity: qty, amount }],
          totalAmount: amount,
          difference,
          strategy: 'single-price'
        };
      }
      
      // If perfect match, return immediately
      if (difference < 1) {
        logger.info('Perfect match found', { price, qty, amount });
        return bestCombination;
      }
    }
  }
  
  // STRATEGY 2: Try two-price combinations (better accuracy)
  if (smallestDifference > 50 && prices.length >= 2) {
    for (let i = 0; i < prices.length; i++) {
      for (let j = i; j < prices.length; j++) {
        const price1 = prices[i];
        const price2 = prices[j];
        
        // Try different quantity combinations (max 20 iterations each)
        for (let qty1 = 0; qty1 <= 20; qty1++) {
          const remaining = targetTaxableAmount - (qty1 * price1);
          const qty2 = Math.round(remaining / price2);
          
          if (qty2 < 0 || qty2 > 20) continue;
          
          const amount = (qty1 * price1) + (qty2 * price2);
          const difference = Math.abs(targetTaxableAmount - amount);
          
          if (difference < smallestDifference) {
            smallestDifference = difference;
            const products = [];
            if (qty1 > 0) products.push({ price: price1, quantity: qty1, amount: qty1 * price1 });
            if (qty2 > 0) products.push({ price: price2, quantity: qty2, amount: qty2 * price2 });
            
            bestCombination = {
              products,
              totalAmount: amount,
              difference,
              strategy: 'two-price'
            };
          }
          
          if (difference < 1) break;
        }
      }
    }
  }
  
  logger.info('Best combination found', {
    strategy: bestCombination?.strategy,
    products: bestCombination?.products,
    difference: bestCombination?.difference,
    accuracy: `${(100 - (bestCombination?.difference / targetTaxableAmount * 100)).toFixed(2)}%`
  });
  
  return bestCombination;
};

// Generate monthly bill
const generateBill = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { buyerId, month, year, companyId } = req.body;
    const organizationId = req.user.organizationId;

    // Validation
    if (!buyerId || !month || !year) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Buyer ID, month, and year are required'
      });
    }

    // Get settings
    const settings = await Settings.findOne({ organizationId }).session(session);
    if (!settings) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Settings not found. Please configure company details first.'
      });
    }

    // Get companies
    let companies = settings.companies || [];
    if (!companies || companies.length === 0) {
      const defaultCompany = {
        id: 'company1',
        name: settings.companyName || 'My Company',
        legalName: settings.companyName || 'My Company',
        gstin: settings.gstNumber || '',
        pan: '',
        address: {
          line1: settings.address || '',
          line2: '',
          city: '',
          state: 'Gujarat',
          pincode: '',
          stateCode: '24'
        },
        contact: {
          phone: settings.phone || '',
          email: settings.email || ''
        },
        bank: {
          name: '',
          accountNo: '',
          ifsc: '',
          branch: ''
        },
        logo: '',
        isDefault: true
      };
      companies = [defaultCompany];
      settings.companies = companies;
      await settings.save({ session });
    }

    // Get company details
    const billingSettings = settings.billingSettings || {
      defaultCompanyId: 'company1',
      paymentTermDays: 30,
      hsnCode: '6203',
      gstRate: settings.gstPercentage || 5,
      billNumberPrefix: 'VR'
    };

    const selectedCompanyId = companyId || billingSettings.defaultCompanyId || 'company1';
    const company = companies.find(c => c.id === selectedCompanyId);

    if (!company) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Company details not found'
      });
    }

    // Get buyer
    const buyer = await WholesaleBuyer.findOne({
      _id: buyerId,
      organizationId
    }).session(session);

    if (!buyer) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }

    // Calculate billing period dates
    const startDate = new Date(year, getMonthNumber(month), 1);
    const endDate = new Date(year, getMonthNumber(month) + 1, 0, 23, 59, 59);

    // Check if bill already exists
    const existingBill = await MonthlyBill.findOne({
      organizationId,
      'buyer.id': buyerId,
      'billingPeriod.month': month,
      'billingPeriod.year': year
    }).session(session);

    if (existingBill) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Bill already exists for this buyer and period'
      });
    }

    // Get all orders for this buyer in this period
    const orders = await WholesaleOrder.find({
      buyerId: buyer._id,
      organizationId,
      createdAt: {
        $gte: startDate,
        $lte: endDate
      },
      deletedAt: null
    })
      .sort({ createdAt: 1 })
      .session(session);

    if (orders.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'No orders found for this buyer in the selected period'
      });
    }

    // Build challans array
    const gstRate = billingSettings.gstRate || settings.gstPercentage || 5;
    const challans = orders.map(order => {
      const itemsQty = order.items.reduce((sum, item) => sum + item.quantity, 0);
      const taxableAmount = order.totalAmount / (1 + gstRate / 100);
      const gstAmount = order.totalAmount - taxableAmount;

      const itemsWithTaxableAmounts = order.items.map(item => {
        const qty = item.quantity || 0;
        const price = item.pricePerUnit || 0;
        return {
          color: item.color || '',
          size: item.size || '',
          quantity: qty,
          price: parseFloat(price.toFixed(2)),
          amount: parseFloat((qty * price).toFixed(2))
        };
      });

      return {
        challanId: order._id,
        challanNumber: order.challanNumber,
        challanDate: order.createdAt,
        items: itemsWithTaxableAmounts,
        itemsQty: itemsQty,
        taxableAmount: parseFloat(taxableAmount.toFixed(2)),
        gstAmount: parseFloat(gstAmount.toFixed(2)),
        totalAmount: order.totalAmount
      };
    });

    // 🔥 NEW: Check if buyer has unbilled amount from previous period
    const previousUnbilledAmount = req.body.adjustPreviousUnbilled || 0; // From frontend

    if (previousUnbilledAmount > 0) {
      logger.info('🔧 Adjusting for unbilled previous amount', {
        buyerId: buyer._id,
        unbilledAmount: previousUnbilledAmount,
        month,
        year
      });
      
      // STEP 1: Convert to taxable amount
      const targetTaxable = previousUnbilledAmount / (1 + gstRate / 100);
      
      // STEP 2: Extract unique prices from current orders
      const availablePrices = [];
      orders.forEach(order => {
        order.items.forEach(item => {
          if (item.pricePerUnit && item.pricePerUnit > 0) {
            availablePrices.push(item.pricePerUnit);
          }
        });
      });
      
      if (availablePrices.length === 0) {
        logger.warn('No product prices available for adjustment');
      } else {
        // STEP 3: Find best product combination
        const combination = findBestProductCombination(targetTaxable, availablePrices, gstRate);
        
        if (combination) {
          // STEP 4: Create adjustment challan
          const adjustmentItems = combination.products.map(p => {
            // Find a product with this price to get color/size
            let productInfo = { color: 'Mixed', size: 'Assorted' };
            
            for (const order of orders) {
              const matchingItem = order.items.find(item => item.pricePerUnit === p.price);
              if (matchingItem) {
                productInfo = { color: matchingItem.color, size: matchingItem.size };
                break;
              }
            }
            
            return {
              color: productInfo.color,
              size: productInfo.size,
              quantity: p.quantity,
              price: parseFloat(p.price.toFixed(2)),
              amount: parseFloat(p.amount.toFixed(2))
            };
          });
          
          const adjustmentTaxable = combination.totalAmount;
          const adjustmentGst = adjustmentTaxable * (gstRate / 100);
          const adjustmentTotal = adjustmentTaxable + adjustmentGst;
          
          const adjustmentChallan = {
            challanId: null, // No actual order
            challanNumber: 'PREV-ADJ', // Special marker
            challanDate: new Date(),
            items: adjustmentItems,
            itemsQty: combination.products.reduce((sum, p) => sum + p.quantity, 0),
            taxableAmount: parseFloat(adjustmentTaxable.toFixed(2)),
            gstAmount: parseFloat(adjustmentGst.toFixed(2)),
            totalAmount: parseFloat(adjustmentTotal.toFixed(2))
          };
          
          // Add to challans array
          challans.push(adjustmentChallan);
          
          logger.info('✅ Adjustment challan added', {
            targetAmount: previousUnbilledAmount,
            actualAmount: adjustmentTotal,
            difference: Math.abs(previousUnbilledAmount - adjustmentTotal),
            products: combination.products,
            accuracy: `${(100 - (combination.difference / targetTaxable * 100)).toFixed(2)}%`
          });
        }
      }
    }

    // Calculate financials
    const totalTaxableAmount = challans.reduce((sum, c) => sum + c.taxableAmount, 0);
    const totalGstAmount = challans.reduce((sum, c) => sum + c.gstAmount, 0);
    const invoiceTotal = challans.reduce((sum, c) => sum + c.totalAmount, 0);

    // Check if same state for CGST/SGST or IGST
    const buyerState = buyer.stateCode || company.address?.stateCode || '24';
    const companyState = company.address?.stateCode || '24';
    const isSameState = buyerState === companyState;

    const cgst = isSameState ? totalGstAmount / 2 : 0;
    const sgst = isSameState ? totalGstAmount / 2 : 0;
    const igst = !isSameState ? totalGstAmount : 0;

    // Get previous outstanding (unpaid bills)
    // 🔥 NEW: If we're adjusting previous unbilled amount, skip previous outstanding
    let previousOutstanding = 0;

    if (!previousUnbilledAmount || previousUnbilledAmount === 0) {
      // Normal flow - get previous outstanding from unpaid bills
      const previousBills = await MonthlyBill.find({
        organizationId,
        'buyer.id': buyerId,
        status: { $in: ['generated', 'sent', 'partial', 'overdue'] },
        'billingPeriod.endDate': { $lt: startDate }
      }).session(session);

      previousOutstanding = previousBills.reduce((sum, bill) => 
        sum + bill.financials.balanceDue, 0
      );
      
      logger.info('Previous outstanding calculated from unpaid bills', {
        buyerId,
        previousBills: previousBills.length,
        previousOutstanding
      });
    } else {
      // Adjustment mode - previous unbilled amount is already included in products
      logger.info('🔧 Skipping previous outstanding (adjustment mode)', {
        buyerId,
        adjustmentAmount: previousUnbilledAmount
      });
    }

    // ✅ NEW: Check if challans in this bill are already paid
    const challanIds = challans.map(c => c.challanId);

    const ordersWithPayments = await WholesaleOrder.find({
      _id: { $in: challanIds },
      organizationId
    }).session(session);

    // Calculate how much has been paid for these challans
    let totalPaidFromChallans = 0;
    const paymentHistoryFromChallans = [];

    for (const order of ordersWithPayments) {
      totalPaidFromChallans += order.amountPaid || 0;
      
      // Collect payment history from orders
      if (order.paymentHistory && order.paymentHistory.length > 0) {
        order.paymentHistory.forEach(payment => {
          paymentHistoryFromChallans.push({
            amount: payment.amount,
            paymentDate: payment.paymentDate,
            paymentMethod: payment.paymentMethod,
            notes: payment.notes || `Payment for challan ${order.challanNumber}`,
            recordedBy: payment.recordedBy || "System",
            recordedByRole: payment.recordedByRole || "admin"
          });
        });
      }
    }

    logger.info('Challan payments detected during bill generation', {
      buyerId: buyer._id,
      month,
      year,
      totalPaidFromChallans,
      paymentsCount: paymentHistoryFromChallans.length
    });

    // Calculate grand total and balance
    const grandTotal = invoiceTotal + previousOutstanding;
    const amountPaid = totalPaidFromChallans;
    const balanceDue = Math.max(0, grandTotal - amountPaid);

    const status = 'draft';

    // Generate bill number (with optional custom sequence for first bill)
    const { customSequence } = req.body; // Get from request
    const billNumber = await generateBillNumber(organizationId, customSequence, session);

    // Calculate financial year
    const billMonth = startDate.getMonth(); // 0-11
    const billYear = startDate.getFullYear();
    const financialYear = billMonth < 3 ? billYear - 1 : billYear;
    const financialYearString = `${financialYear}-${(financialYear + 1).toString().slice(-2)}`;

    // Calculate due date
    const paymentTermDays = billingSettings.paymentTermDays || 30;
    const paymentDueDate = new Date(endDate);
    paymentDueDate.setDate(paymentDueDate.getDate() + paymentTermDays);

    // Create bill
    const bill = await MonthlyBill.create([{
      billNumber,
      financialYear: financialYearString,
      company: {
        id: company.id,
        name: company.name,
        legalName: company.legalName || company.name,
        gstin: company.gstin,
        pan: company.pan,
        address: company.address,
        contact: company.contact,
        bank: company.bank,
        logo: company.logo
      },
      buyer: {
        id: buyer._id,
        name: buyer.name,
        mobile: buyer.mobile,
        email: buyer.email,
        businessName: buyer.businessName,
        gstin: buyer.gstNumber,
        pan: buyer.pan || (buyer.gstNumber && buyer.gstNumber.length >= 12 ? buyer.gstNumber.substring(2, 12) : ''),
        address: buyer.address,
        stateCode: buyerState
      },
      billingPeriod: {
        month,
        year,
        startDate,
        endDate
      },
      challans,
      financials: {
        totalTaxableAmount: parseFloat(totalTaxableAmount.toFixed(2)),
        cgst: parseFloat(cgst.toFixed(2)),
        sgst: parseFloat(sgst.toFixed(2)),
        igst: parseFloat(igst.toFixed(2)),
        gstRate,
        invoiceTotal: parseFloat(invoiceTotal.toFixed(2)),
        previousOutstanding: parseFloat(previousOutstanding.toFixed(2)),
        grandTotal: parseFloat(grandTotal.toFixed(2)),
        amountPaid: parseFloat(amountPaid.toFixed(2)),  // ✅ From challan payments
        balanceDue: parseFloat(balanceDue.toFixed(2))
      },
      status,  // ✅ Auto-calculated
      paymentDueDate,
      paymentHistory: paymentHistoryFromChallans,  // ✅ Include challan payments
      hsnCode: billingSettings.hsnCode || '6203',
      organizationId,
      finalizedAt: status !== 'draft' ? new Date() : null
    }], { session });

    // ✅ NEW: Add bill to buyer's tracking
    if (!buyer.monthlyBills) {
      buyer.monthlyBills = [];
    }

    buyer.monthlyBills.push({
      billId: bill[0]._id,
      billNumber,
      month,
      year,
      invoiceTotal: parseFloat(invoiceTotal.toFixed(2)),
      amountPaid: parseFloat(amountPaid.toFixed(2)),
      balanceDue: parseFloat(balanceDue.toFixed(2)),
      status,
      generatedAt: new Date()
    });

    // ✅ Recalculate buyer's totalDue from bills
    buyer.totalDue = buyer.monthlyBills.reduce((sum, b) => sum + b.balanceDue, 0);
    buyer.totalPaid = buyer.monthlyBills.reduce((sum, b) => sum + b.amountPaid, 0);

    await buyer.save({ session });

    await session.commitTransaction();

    logger.info('Bill generated successfully with challan payments', {
      billId: bill[0]._id,
      billNumber,
      buyer: buyer.name,
      status,
      amountPaid,
      balanceDue
    });

    res.status(201).json({
      success: true,
      message: 'Bill generated successfully',
      data: bill[0]
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Bill generation failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to generate bill',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// Helper function to get month number
const getMonthNumber = (monthName) => {
  const months = {
    'January': 0, 'February': 1, 'March': 2, 'April': 3,
    'May': 4, 'June': 5, 'July': 6, 'August': 7,
    'September': 8, 'October': 9, 'November': 10, 'December': 11
  };
  return months[monthName];
};

// Switch company for a bill
const switchCompany = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { companyId } = req.body;
    const organizationId = req.user.organizationId;

    const bill = await MonthlyBill.findOne({
      _id: id,
      organizationId
    }).session(session);

    if (!bill) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    if (bill.status !== 'draft') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Can only switch company for draft bills'
      });
    }

    // Get company details from settings
    const settings = await Settings.findOne({ organizationId }).session(session);
    
    // ✅ FIX: Get companies from correct location
    const companies = settings.editPermissions?.companies || settings.companies || [];
    const company = companies.find(c => c.id === companyId);

    if (!company) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Update company details
    bill.company = {
      id: company.id,
      name: company.name,
      legalName: company.legalName || company.name,
      gstin: company.gstin,
      pan: company.pan,
      address: company.address,
      contact: company.contact,
      bank: company.bank,
      logo: company.logo
    };

    await bill.save({ session });
    await session.commitTransaction();

    logger.info('Company switched for bill', {
      billId: bill._id,
      newCompany: company.name
    });

    res.json({
      success: true,
      message: 'Company updated successfully',
      data: bill
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Company switch failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to switch company',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// Finalize bill
const finalizeBill = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const bill = await MonthlyBill.findOne({
      _id: id,
      organizationId
    });

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    if (bill.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Bill is already finalized'
      });
    }

    bill.status = 'generated';
    bill.finalizedAt = new Date();
    await bill.save();

    logger.info('Bill finalized', {
      billId: bill._id,
      billNumber: bill.billNumber
    });

    res.json({
      success: true,
      message: 'Bill finalized successfully',
      data: bill
    });

  } catch (error) {
    logger.error('Bill finalization failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to finalize bill',
      error: error.message
    });
  }
};

// Record payment against bill
const recordPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { amount, paymentMethod, paymentDate, notes } = req.body;
    const organizationId = req.user.organizationId;

    if (!amount || amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid payment amount'
      });
    }

    const bill = await MonthlyBill.findOne({
      _id: id,
      organizationId
    }).session(session);

    if (!bill) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    if (bill.financials.balanceDue <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Bill is already fully paid'
      });
    }

    // Add payment to history
    bill.paymentHistory.push({
      amount: parseFloat(amount),
      paymentDate: paymentDate || new Date(),
      paymentMethod: paymentMethod || 'Cash',
      notes: notes || '',
      recordedBy: req.user.email || req.user.username,
      recordedByRole: req.user.role
    });

    // Update financials
    bill.financials.amountPaid += parseFloat(amount);
    bill.financials.balanceDue = bill.financials.grandTotal - bill.financials.amountPaid;

    // Update status
    if (bill.financials.balanceDue <= 0) {
      bill.status = 'paid';
      bill.paidAt = new Date();
    } else {
      bill.status = 'partial';
    }

    await bill.save({ session });

    // Update buyer's total due
    const buyer = await WholesaleBuyer.findById(bill.buyer.id).session(session);
    if (buyer) {
      buyer.totalDue = Math.max(0, buyer.totalDue - parseFloat(amount));
      buyer.totalPaid = (buyer.totalPaid || 0) + parseFloat(amount);
      await buyer.save({ session });
    }

    await session.commitTransaction();

    logger.info('Payment recorded against bill', {
      billId: bill._id,
      amount,
      newBalance: bill.financials.balanceDue
    });

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      data: bill
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Payment recording failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to record payment',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// ✅ NEW: Record advance payment (before bill generation)
const recordAdvancePayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params; // buyer ID
    const { amount, paymentMethod, paymentDate, forMonth, forYear, notes } = req.body;
    const organizationId = req.user.organizationId;

    // Validation
    if (!amount || amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid payment amount'
      });
    }

    if (!forMonth || !forYear) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Month and year are required for advance payment'
      });
    }

    const buyer = await WholesaleBuyer.findOne({
      _id: id,
      organizationId
    }).session(session);

    if (!buyer) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }

    // Check if bill already exists for this period
    const existingBill = await MonthlyBill.findOne({
      organizationId,
      'buyer.id': id,
      'billingPeriod.month': forMonth,
      'billingPeriod.year': forYear
    }).session(session);

    if (existingBill) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Bill already exists for ${forMonth} ${forYear}. Please record payment against the bill instead.`,
        billId: existingBill._id,
        billNumber: existingBill.billNumber
      });
    }

    // Add advance payment
    buyer.advancePayments.push({
      amount: parseFloat(amount),
      paymentDate: paymentDate || new Date(),
      paymentMethod: paymentMethod || 'Cash',
      forMonth,
      forYear,
      status: 'pending_allocation',
      notes: notes || '',
      recordedBy: req.user.email || req.user.username,
      recordedByRole: req.user.role
    });

    await buyer.save({ session });

    await session.commitTransaction();

    logger.info('Advance payment recorded', {
      buyerId: buyer._id,
      amount,
      forMonth,
      forYear,
      recordedBy: req.user.email
    });

    res.json({
      success: true,
      message: `Advance payment of ₹${amount.toLocaleString('en-IN')} recorded for ${forMonth} ${forYear}`,
      data: {
        amount,
        forMonth,
        forYear,
        status: 'Will be applied when bill is generated'
      }
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Advance payment recording failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to record advance payment',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// ✅ UPDATED: Record payment against existing bill (with sync)
const recordPaymentForBill = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params; // bill ID
    const { amount, paymentMethod, paymentDate, notes } = req.body;
    const organizationId = req.user.organizationId;

    if (!amount || amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid payment amount'
      });
    }

    const bill = await MonthlyBill.findOne({
      _id: id,
      organizationId
    }).session(session);

    if (!bill) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    if (bill.financials.balanceDue <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Bill is already fully paid'
      });
    }

    // Validate amount doesn't exceed balance
    if (amount > bill.financials.balanceDue) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Payment amount (₹${amount}) exceeds balance due (₹${bill.financials.balanceDue})`
      });
    }

    // Add payment to history
    bill.paymentHistory.push({
      amount: parseFloat(amount),
      paymentDate: paymentDate || new Date(),
      paymentMethod: paymentMethod || 'Cash',
      notes: notes || '',
      recordedBy: req.user.email || req.user.username,
      recordedByRole: req.user.role
    });

    // Update financials
    bill.financials.amountPaid += parseFloat(amount);
    bill.financials.balanceDue -= parseFloat(amount);

    // Update status
    if (bill.financials.balanceDue <= 0) {
      bill.status = 'paid';
      bill.paidAt = new Date();
    } else {
      bill.status = 'partial';
    }

    await bill.save({ session });

    // ✅ SYNC TO BUYER
    const buyer = await WholesaleBuyer.findOne({
      _id: bill.buyer.id,
      organizationId
    }).session(session);

    if (buyer) {
      // Find and update the bill in buyer's monthlyBills array
      const buyerBillIndex = buyer.monthlyBills.findIndex(
        b => b.billId.toString() === bill._id.toString()
      );

      if (buyerBillIndex !== -1) {
        buyer.monthlyBills[buyerBillIndex].amountPaid = bill.financials.amountPaid;
        buyer.monthlyBills[buyerBillIndex].balanceDue = bill.financials.balanceDue;
        buyer.monthlyBills[buyerBillIndex].status = bill.status;
      }

      // Recalculate buyer's total due and paid
      buyer.totalDue = buyer.monthlyBills.reduce((sum, b) => sum + b.balanceDue, 0);
      buyer.totalPaid = buyer.monthlyBills.reduce((sum, b) => sum + b.amountPaid, 0);

      await buyer.save({ session });

      logger.info('Payment synced to buyer', {
        buyerId: buyer._id,
        newTotalDue: buyer.totalDue,
        newTotalPaid: buyer.totalPaid
      });
    }

    await session.commitTransaction();

    logger.info('Payment recorded against bill', {
      billId: bill._id,
      amount,
      newBalance: bill.financials.balanceDue
    });

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        billNumber: bill.billNumber,
        amountPaid: amount,
        newBalance: bill.financials.balanceDue,
        status: bill.status
      }
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Payment recording failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to record payment',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// ✅ NEW: Get buyer's bills with pending amounts
const getBuyerBills = async (req, res) => {
  try {
    const { id } = req.params; // buyer ID
    const { month, year, status } = req.query;
    const organizationId = req.user.organizationId;

    const buyer = await WholesaleBuyer.findOne({
      _id: id,
      organizationId
    }).select('name mobile businessName monthlyBills advancePayments');

    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }

    // Build query for bills
    const billQuery = {
      organizationId,
      'buyer.id': id
    };

    if (month && year) {
      billQuery['billingPeriod.month'] = month;
      billQuery['billingPeriod.year'] = parseInt(year);
    }

    if (status && status !== 'all') {
      billQuery.status = status;
    }

    const bills = await MonthlyBill.find(billQuery)
      .sort({ 'billingPeriod.year': -1, 'billingPeriod.month': -1 })
      .lean();

    // Get pending advance payments
    const pendingAdvancePayments = buyer.advancePayments.filter(
      p => p.status === 'pending_allocation'
    );

    // Calculate summary
    const summary = {
      totalBills: bills.length,
      totalInvoiced: bills.reduce((sum, b) => sum + b.financials.invoiceTotal, 0),
      totalPaid: bills.reduce((sum, b) => sum + b.financials.amountPaid, 0),
      totalDue: bills.reduce((sum, b) => sum + b.financials.balanceDue, 0),
      pendingAdvancePayments: pendingAdvancePayments.length,
      totalAdvanceAmount: pendingAdvancePayments.reduce((sum, p) => sum + p.amount, 0)
    };

    res.json({
      success: true,
      data: {
        buyer: {
          id: buyer._id,
          name: buyer.name,
          mobile: buyer.mobile,
          businessName: buyer.businessName
        },
        bills,
        pendingAdvancePayments,
        summary
      }
    });

  } catch (error) {
    logger.error('Failed to fetch buyer bills:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bills',
      error: error.message
    });
  }
};

// ✅ FIXED: Get complete payment history for a bill (simplified approach)
const getBillPaymentHistory = async (req, res) => {
  try {
    const { id } = req.params; // bill ID
    const organizationId = req.user.organizationId;

    const bill = await MonthlyBill.findOne({
      _id: id,
      organizationId
    }).lean();

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    // Get ALL payment history from the bill
    const allPayments = (bill.paymentHistory || []).map(payment => {
      // Determine if this is a challan payment (before bill) or new payment (after bill)
      // Challan payments have notes like "Payment for challan XXX"
      const isBeforeBill = payment.notes && payment.notes.includes('Payment for challan');
      
      return {
        amount: payment.amount,
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod || 'Cash',
        notes: payment.notes || 'Payment',
        recordedBy: payment.recordedBy || 'System',
        recordedByRole: payment.recordedByRole || 'admin',
        source: isBeforeBill ? 'before_bill' : 'after_bill',
        challanNumber: isBeforeBill ? payment.notes.match(/challan\s+(\S+)/)?.[1] : null
      };
    });

    // Sort by date (oldest first)
    const sortedPayments = allPayments.sort((a, b) => 
      new Date(b.paymentDate) - new Date(a.paymentDate)
    );

    // Calculate running balance
    let runningBalance = bill.financials.grandTotal;
    const paymentsWithBalance = sortedPayments.map(payment => {
      runningBalance -= payment.amount;
      return {
        ...payment,
        balanceAfterPayment: Math.max(0, runningBalance)
      };
    });

    const paymentsBeforeBill = sortedPayments.filter(p => p.source === 'before_bill').length;
    const paymentsAfterBill = sortedPayments.filter(p => p.source === 'after_bill').length;

    res.json({
      success: true,
      data: {
        bill: {
          billNumber: bill.billNumber,
          month: bill.billingPeriod.month,
          year: bill.billingPeriod.year,
          buyerName: bill.buyer.name,
          grandTotal: bill.financials.grandTotal,
          amountPaid: bill.financials.amountPaid,
          balanceDue: bill.financials.balanceDue,
          status: bill.status
        },
        payments: paymentsWithBalance,
        summary: {
          totalPayments: sortedPayments.length,
          paymentsBeforeBill: paymentsBeforeBill,
          paymentsAfterBill: paymentsAfterBill,
          totalPaid: sortedPayments.reduce((sum, p) => sum + p.amount, 0)
        }
      }
    });

  } catch (error) {
    logger.error('Failed to fetch bill payment history', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history',
      error: error.message
    });
  }
};

// ✅ NEW: Get current month pending for buyer
const getBuyerCurrentMonthPending = async (req, res) => {
  try {
    const { id } = req.params; // buyer ID
    const organizationId = req.user.organizationId;

    const now = new Date();
    const currentMonth = now.toLocaleString('en-US', { month: 'long' });
    const currentYear = now.getFullYear();

    // Find bill for current month
    const currentBill = await MonthlyBill.findOne({
      organizationId,
      'buyer.id': id,
      'billingPeriod.month': currentMonth,
      'billingPeriod.year': currentYear
    }).lean();

    // Get advance payments for current month
    const buyer = await WholesaleBuyer.findOne({
      _id: id,
      organizationId
    }).select('advancePayments');

    const currentMonthAdvancePayments = buyer?.advancePayments?.filter(
      p => p.forMonth === currentMonth && 
           p.forYear === currentYear && 
           p.status === 'pending_allocation'
    ) || [];

    const totalAdvance = currentMonthAdvancePayments.reduce((sum, p) => sum + p.amount, 0);

    res.json({
      success: true,
      data: {
        month: currentMonth,
        year: currentYear,
        billGenerated: !!currentBill,
        bill: currentBill ? {
          billNumber: currentBill.billNumber,
          invoiceTotal: currentBill.financials.invoiceTotal,
          amountPaid: currentBill.financials.amountPaid,
          balanceDue: currentBill.financials.balanceDue,
          status: currentBill.status
        } : null,
        advancePayments: currentMonthAdvancePayments,
        totalAdvance,
        pendingAmount: currentBill ? currentBill.financials.balanceDue : 0
      }
    });

  } catch (error) {
    logger.error('Failed to fetch current month pending:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending amount',
      error: error.message
    });
  }
};

// ✅ NEW: Delete advance payment
const deleteAdvancePayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id, paymentId } = req.params; // buyer ID and payment ID
    const organizationId = req.user.organizationId;

    const buyer = await WholesaleBuyer.findOne({
      _id: id,
      organizationId
    }).session(session);

    if (!buyer) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }

    const payment = buyer.advancePayments.id(paymentId);

    if (!payment) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (payment.status === 'allocated') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Cannot delete allocated payment. It has been applied to a bill.'
      });
    }

    buyer.advancePayments.pull(paymentId);
    await buyer.save({ session });

    await session.commitTransaction();

    logger.info('Advance payment deleted', {
      buyerId: id,
      paymentId,
      deletedBy: req.user.email
    });

    res.json({
      success: true,
      message: 'Advance payment deleted successfully'
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Failed to delete advance payment:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to delete payment',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

const deleteBill = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const bill = await MonthlyBill.findOne({ _id: id, organizationId }).session(session);
    
    if (!bill) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    if (bill.status !== 'draft') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Can only delete draft bills' });
    }

    // Remove bill from buyer's monthlyBills array
    const buyer = await WholesaleBuyer.findById(bill.buyer.id).session(session);
    if (buyer) {
      // Remove the bill from buyer's monthlyBills array
      buyer.monthlyBills = buyer.monthlyBills.filter(
        b => b.billId.toString() !== bill._id.toString()
      );
      
      // ✅ CHECK: If no more bills exist, restore from orders
      if (buyer.monthlyBills.length === 0) {
        logger.info('No more bills - recalculating from orders', { buyerId: buyer._id });
        
        // Get all orders for this buyer
        const orders = await WholesaleOrder.find({
          buyerId: buyer._id,
          organizationId: buyer.organizationId,
          deletedAt: null
        }).session(session);
        
        // Recalculate from orders
        buyer.totalDue = orders.reduce((sum, o) => sum + (o.amountDue || 0), 0);
        buyer.totalPaid = orders.reduce((sum, o) => sum + (o.amountPaid || 0), 0);
        buyer.totalOrders = orders.length;
        
        logger.info('Buyer totals restored from orders', {
          buyerId: buyer._id,
          totalDue: buyer.totalDue,
          totalPaid: buyer.totalPaid,
          totalOrders: buyer.totalOrders
        });
      } else {
        // Still has bills - recalculate from bills
        buyer.totalDue = buyer.monthlyBills.reduce((sum, b) => sum + (b.balanceDue || 0), 0);
        buyer.totalPaid = buyer.monthlyBills.reduce((sum, b) => sum + (b.amountPaid || 0), 0);
        
        logger.info('Buyer totals recalculated from remaining bills', {
          buyerId: buyer._id,
          billsRemaining: buyer.monthlyBills.length,
          totalDue: buyer.totalDue,
          totalPaid: buyer.totalPaid
        });
      }
      
      await buyer.save({ session });
    }

    // Delete the bill
    await MonthlyBill.findByIdAndDelete(id).session(session);

    await session.commitTransaction();
    logger.info('Bill deleted successfully', { 
      billId: id, 
      billNumber: bill.billNumber,
      buyerId: bill.buyer.id
    });
    
    res.json({ 
      success: true, 
      message: 'Bill deleted successfully',
      data: {
        buyerId: bill.buyer.id,
        billsRemaining: buyer?.monthlyBills.length || 0,
        newTotalDue: buyer?.totalDue || 0,
        newTotalPaid: buyer?.totalPaid || 0
      }
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Bill deletion failed', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete bill', 
      error: error.message 
    });
  } finally {
    session.endSession();
  }
};

// Get bills stats
const getBillsStats = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const stats = await MonthlyBill.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(organizationId) } },
      {
        $group: {
          _id: null,
          totalBills: { $sum: 1 },
          pendingBills: {
            $sum: {
              $cond: [{ $in: ['$status', ['generated', 'sent', 'partial', 'overdue']] }, 1, 0]
            }
          },
          paidBills: {
            $sum: {
              $cond: [{ $eq: ['$status', 'paid'] }, 1, 0]
            }
          },
          draftBills: {
            $sum: {
              $cond: [{ $eq: ['$status', 'draft'] }, 1, 0]
            }
          },
          totalRevenue: { $sum: '$financials.invoiceTotal' },
          totalOutstanding: { $sum: '$financials.balanceDue' },
          totalCollected: { $sum: '$financials.amountPaid' }
        }
      }
    ]);

    // Get this month's revenue
    const now = new Date();
    const currentMonth = now.toLocaleString('default', { month: 'long' });
    const currentYear = now.getFullYear();

    const thisMonthStats = await MonthlyBill.aggregate([
      {
        $match: {
          organizationId: new mongoose.Types.ObjectId(organizationId),
          'billingPeriod.month': currentMonth,
          'billingPeriod.year': currentYear
        }
      },
      {
        $group: {
          _id: null,
          thisMonthRevenue: { $sum: '$financials.invoiceTotal' },
          thisMonthBills: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        ...stats[0],
        thisMonthRevenue: thisMonthStats[0]?.thisMonthRevenue || 0,
        thisMonthBills: thisMonthStats[0]?.thisMonthBills || 0
      }
    });

  } catch (error) {
    logger.error('Failed to fetch bill stats:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
};

const customizeBill = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentTermDays, hsnCode, notes, removeChallans } = req.body;
    const organizationId = req.user.organizationId;

    // Find the bill
    const bill = await MonthlyBill.findOne({
      _id: id,
      organizationId
    }).populate('challans.challanId');

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    // Only allow customization of draft bills
    if (bill.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft bills can be customized'
      });
    }

    // Update payment terms if provided
    if (paymentTermDays !== undefined) {
      const endDate = new Date(bill.billingPeriod.endDate);
      const dueDate = new Date(endDate);
      dueDate.setDate(dueDate.getDate() + paymentTermDays);
      bill.paymentDueDate = dueDate;
    }

    // Update HSN code if provided
    if (hsnCode) {
      bill.hsnCode = hsnCode;
    }

    // Update notes if provided
    if (notes !== undefined) {
      bill.notes = notes;
    }

    // Remove challans if specified
    if (removeChallans && removeChallans.length > 0) {
      // Filter out the challans to be removed
      bill.challans = bill.challans.filter(
        c => !removeChallans.includes(c.challanId._id.toString()) && 
             !removeChallans.includes(c.challanId.toString())
      );

      // Recalculate financials
      let invoiceTotal = 0;
      let totalTaxableAmount = 0;
      let totalGST = 0;

      bill.challans.forEach(challan => {
        invoiceTotal += challan.totalAmount;
        totalTaxableAmount += challan.taxableAmount;
        totalGST += challan.gstAmount;
      });

      // Update financial totals
      bill.financials.invoiceTotal = invoiceTotal;
      bill.financials.totalTaxableAmount = totalTaxableAmount;
      bill.financials.totalGST = totalGST;

      // Recalculate CGST/SGST or IGST
      if (bill.financials.cgst > 0) {
        bill.financials.cgst = totalGST / 2;
        bill.financials.sgst = totalGST / 2;
        bill.financials.igst = 0;
      } else {
        bill.financials.igst = totalGST;
        bill.financials.cgst = 0;
        bill.financials.sgst = 0;
      }

      // Recalculate grand total
      const previousOutstanding = bill.financials.previousOutstanding || 0;
      bill.financials.grandTotal = invoiceTotal + previousOutstanding;

      // Recalculate balance due
      const amountPaid = bill.financials.amountPaid || 0;
      bill.financials.balanceDue = bill.financials.grandTotal - amountPaid;
    }

    // Save the updated bill
    await bill.save();

    // Populate for response
    const updatedBill = await MonthlyBill.findById(bill._id)
      .populate('buyer', 'name businessName mobile email gstin address')
      .populate('challans.challanId')
      .lean();

    console.log('✅ Bill customized successfully', {
      billId: bill._id,
      billNumber: bill.billNumber,
      challansRemoved: removeChallans?.length || 0,
      newTotal: bill.financials.grandTotal
    });

    res.json({
      success: true,
      message: 'Bill customized successfully',
      data: updatedBill
    });

  } catch (error) {
    console.error('❌ Error customizing bill:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to customize bill',
      error: error.message
    });
  }
};

// NEW: Update bill number for draft bills only
const updateBillNumber = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
    const { customSequence } = req.body; // Just the number: 146
    const { organizationId } = req.user;
    
    // Validation
    if (!customSequence || customSequence < 1) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Valid sequence number is required (must be >= 1)'
      });
    }
    
    // Find bill
    const bill = await MonthlyBill.findOne({ _id: id, organizationId })
      .session(session);
    
    if (!bill) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }
    
    // Only allow for draft bills
    if (bill.status !== 'draft') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Can only update bill number for draft bills'
      });
    }
    
    // Get current bill number parts
    const currentParts = bill.billNumber.match(/^(.+)\/(\d{4})\/(\d+)$/);
    if (!currentParts) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid bill number format'
      });
    }
    
    const prefix = currentParts[1]; // VR
    const year = currentParts[2];   // 2025
    
    // Generate new bill number with custom sequence
    const newBillNumber = `${prefix}/${year}/${String(customSequence).padStart(2, '0')}`;
    
    // Check if new number already exists
    const existingBill = await MonthlyBill.findOne({
      billNumber: newBillNumber,
      organizationId,
      _id: { $ne: id } // Exclude current bill
    }).session(session);
    
    if (existingBill) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Bill number ${newBillNumber} already exists`,
        existingBillId: existingBill._id
      });
    }
    
    // Update bill number
    const oldBillNumber = bill.billNumber;
    bill.billNumber = newBillNumber;
    await bill.save({ session });
    
    await session.commitTransaction();
    
    logger.info('Bill number updated', {
      billId: bill._id,
      oldBillNumber,
      newBillNumber,
      customSequence,
      updatedBy: req.user.email
    });
    
    res.json({
      success: true,
      message: 'Bill number updated successfully',
      data: {
        oldBillNumber,
        newBillNumber,
        bill
      }
    });
    
  } catch (error) {
    await session.abortTransaction();
    logger.error('Bill number update failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update bill number',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// ✅ PERFECT: Delete payment from bill history (Admin only)
const deletePaymentFromBill = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { billId, paymentIndex } = req.params;
    const organizationId = req.user.organizationId;

    // Find bill
    const bill = await MonthlyBill.findOne({
      _id: billId,
      organizationId,
    }).session(session);

    if (!bill) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        code: 'BILL_NOT_FOUND',
        message: 'Bill not found',
      });
    }

    // Get payment to delete
    const paymentToDelete = bill.paymentHistory[parseInt(paymentIndex)];
    
    if (!paymentToDelete) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        code: 'PAYMENT_NOT_FOUND',
        message: 'Payment not found at specified index',
      });
    }

    const deletedAmount = paymentToDelete.amount;
    const isPreBillPayment = paymentToDelete.notes?.includes('Payment for challan') || false;

    logger.info('Deleting payment from bill', {
      billId: bill._id,
      billNumber: bill.billNumber,
      paymentIndex,
      deletedAmount,
      isPreBillPayment,
    });

    // Remove payment from history
    bill.paymentHistory.splice(parseInt(paymentIndex), 1);

    // ✅ FIXED: Only adjust financials if this is NOT a pre-bill challan payment
    if (!isPreBillPayment) {
      // This is a payment made AFTER bill generation - adjust bill totals
      bill.financials.amountPaid = Math.max(0, bill.financials.amountPaid - deletedAmount);
      bill.financials.balanceDue = bill.financials.grandTotal - bill.financials.amountPaid;

      // ✅ FIXED: Update bill status with correct enum values
      if (bill.financials.balanceDue === 0) {
        // Fully paid
        bill.status = 'paid';
        bill.paidAt = new Date();
      } else if (bill.financials.balanceDue >= bill.financials.grandTotal) {
        // Full balance restored - back to generated (unpaid)
        bill.status = 'generated';
        bill.paidAt = null;
      } else if (bill.financials.amountPaid > 0 && bill.financials.balanceDue > 0) {
        // Partially paid
        bill.status = 'partial';
        bill.paidAt = null;
      } else {
        // Default to generated
        bill.status = 'generated';
        bill.paidAt = null;
      }

      logger.info('Bill financials updated after payment deletion', {
        amountPaid: bill.financials.amountPaid,
        balanceDue: bill.financials.balanceDue,
        status: bill.status,
      });
    }

    await bill.save({ session });

    // ✅ Update buyer totals if not pre-bill payment
    if (!isPreBillPayment) {
      const buyer = await WholesaleBuyer.findById(bill.buyer.id).session(session);
      
      if (buyer) {
        const buyerBillIndex = buyer.monthlyBills.findIndex(
          (b) => b.billId.toString() === bill._id.toString()
        );

        if (buyerBillIndex !== -1) {
          buyer.monthlyBills[buyerBillIndex].amountPaid = bill.financials.amountPaid;
          buyer.monthlyBills[buyerBillIndex].balanceDue = bill.financials.balanceDue;
          buyer.monthlyBills[buyerBillIndex].status = bill.status;
        }

        // Recalculate totals
        buyer.totalDue = buyer.monthlyBills.reduce((sum, b) => sum + (b.balanceDue || 0), 0);
        buyer.totalPaid = buyer.monthlyBills.reduce((sum, b) => sum + (b.amountPaid || 0), 0);

        await buyer.save({ session });

        logger.info('Buyer totals updated after payment deletion', {
          buyerId: buyer._id,
          newTotalDue: buyer.totalDue,
          newTotalPaid: buyer.totalPaid,
        });
      }
    }

    await session.commitTransaction();

    logger.info('Payment deleted successfully', {
      billId: bill._id,
      billNumber: bill.billNumber,
      deletedAmount,
      isPreBillPayment,
      newBalanceDue: bill.financials.balanceDue,
      deletedBy: req.user.email,
    });

    res.json({
      success: true,
      message: isPreBillPayment 
        ? 'Challan payment removed from history (bill totals unchanged)' 
        : 'Payment deleted and balance restored',
      data: {
        bill: {
          _id: bill._id,
          billNumber: bill.billNumber,
          status: bill.status,
          amountPaid: bill.financials.amountPaid,
          balanceDue: bill.financials.balanceDue,
        },
        deletedAmount,
        isPreBillPayment,
        newBalanceDue: bill.financials.balanceDue,
        newAmountPaid: bill.financials.amountPaid,
      },
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Failed to delete payment from bill', {
      error: error.message,
      stack: error.stack,
      billId: req.params.billId,
      paymentIndex: req.params.paymentIndex,
    });
    
    res.status(500).json({
      success: false,
      code: 'DELETE_FAILED',
      message: 'Failed to delete payment',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Split bill into multiple bills with different GST profiles - SMART HYBRID ALGORITHM
// Split bill into multiple bills with different GST profiles - FIXED VERSION
const splitBill = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params; // Parent bill ID
    const { splits } = req.body; // Array of split configurations
    const organizationId = req.user.organizationId;

    // Validation
    if (!splits || !Array.isArray(splits) || splits.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Split configurations are required'
      });
    }

    // Find parent bill
    const parentBill = await MonthlyBill.findOne({
      _id: id,
      organizationId
    }).session(session);

    if (!parentBill) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    // Only allow splitting draft bills
    if (parentBill.status !== 'draft') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Only draft bills can be split'
      });
    }

    // Validate total amounts
    const totalRequestedAmount = splits.reduce((sum, s) => sum + parseFloat(s.targetAmount || 0), 0);
    const billTotal = parentBill.financials.grandTotal;

    if (Math.abs(totalRequestedAmount - billTotal) > 1) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Total split amount (₹${totalRequestedAmount}) must equal bill total (₹${billTotal})`
      });
    }

    // Get buyer with GST profiles
    const buyer = await WholesaleBuyer.findOne({
      _id: parentBill.buyer.id,
      organizationId
    }).session(session);

    if (!buyer) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }

    // Get settings for bill number generation
    const settings = await Settings.findOne({ organizationId }).session(session);

    // Generate split group ID for tracking
    const splitGroupId = `split_${Date.now()}`;

    const gstRate = parentBill.financials.gstRate || 5;

    // ============================================================================
    // STEP 1: FLATTEN ALL ITEMS FROM ALL CHALLANS INTO ITEM POOL
    // ============================================================================
    const itemPool = [];
    
    parentBill.challans.forEach(challan => {
      challan.items.forEach(item => {
        itemPool.push({
          // Original challan reference
          challanId: challan.challanId,
          challanNumber: challan.challanNumber,
          challanDate: challan.challanDate,
          
          // Item details (prices are already taxable in your system)
          color: item.color,
          size: item.size,
          quantity: item.quantity,
          price: item.price, // ✅ Taxable price (₹360, ₹400)
          amount: item.amount, // ✅ Taxable amount (qty × price)
          
          // Keep original challan reference for grouping later
          sourceChallan: {
            id: challan.challanId,
            number: challan.challanNumber,
            date: challan.challanDate
          }
        });
      });
    });

    logger.info('Item pool created for splitting', {
      parentBillId: parentBill._id,
      totalItems: itemPool.length,
      totalAmount: itemPool.reduce((sum, item) => sum + item.amount, 0)
    });

    // ============================================================================
    // STEP 2: SORT ITEMS BY UNIT PRICE (ASCENDING) FOR BETTER PACKING
    // ============================================================================
    itemPool.sort((a, b) => a.price - b.price);

    // ============================================================================
    // STEP 3: DELETE PARENT BILL BEFORE CREATING CHILDREN
    // ============================================================================
    await MonthlyBill.findByIdAndDelete(parentBill._id).session(session);
    logger.info('Parent bill deleted before creating children', {
      parentBillId: parentBill._id,
      parentBillNumber: parentBill.billNumber
    });

    const createdBills = [];

    // ============================================================================
    // STEP 4: ALLOCATE ITEMS TO EACH SPLIT
    // ============================================================================
    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      const targetAmount = parseFloat(split.targetAmount);
      const isLastSplit = (i === splits.length - 1);

      // Get GST profile for this split
      let gstProfile = null;

      if (split.gstProfileId === 'original_gst') {
        // Use original GST from buyer
        gstProfile = {
          profileId: 'original_gst',
          gstNumber: parentBill.buyer.gstin,
          businessName: parentBill.buyer.businessName || buyer.name,
          pan: parentBill.buyer.pan || '',
          address: parentBill.buyer.address || '',
          stateCode: parentBill.buyer.stateCode || '24',
          isOriginal: true
        };

        logger.info('Using original GST for split', {
          splitIndex: i + 1,
          gstNumber: gstProfile.gstNumber
        });
      } else if (split.gstProfileId) {
        // Use saved GST profile
        gstProfile = buyer.gstProfiles.find(p => p.profileId === split.gstProfileId);

        if (!gstProfile) {
          await session.abortTransaction();
          return res.status(404).json({
            success: false,
            message: `GST profile ${split.gstProfileId} not found for buyer`
          });
        }

        logger.info('Using saved GST profile for split', {
          splitIndex: i + 1,
          profileId: gstProfile.profileId,
          gstNumber: gstProfile.gstNumber
        });
      }

      // Allocate items for this split
      const allocatedItems = [];
      let allocatedAmount = 0;

      if (isLastSplit) {
        // ========================================================================
        // LAST SPLIT: TAKE ALL REMAINING ITEMS (GUARANTEES EXACT TOTAL)
        // ========================================================================
        allocatedItems.push(...itemPool.splice(0));
        allocatedAmount = allocatedItems.reduce((sum, item) => sum + item.amount, 0);

        logger.info('Last split - allocated all remaining items', {
          splitIndex: i + 1,
          targetAmount,
          actualAmount: allocatedAmount,
          itemsAllocated: allocatedItems.length
        });
      } else {
        // ========================================================================
        // REGULAR SPLIT: SMART GREEDY ALLOCATION (WHOLE PIECES ONLY)
        // ========================================================================
        
        // Convert target amount (with GST) to taxable target
        const targetTaxable = targetAmount / (1 + gstRate / 100);
        let remainingTarget = targetTaxable;

        logger.info('Starting allocation for regular split', {
          splitIndex: i + 1,
          targetAmountWithGST: targetAmount,
          targetTaxable: targetTaxable.toFixed(2),
          gstRate
        });

        while (remainingTarget > 0 && itemPool.length > 0) {
          const item = itemPool[0]; // Smallest price item (sorted)
          const itemUnitPrice = item.price;
          const itemTotalAmount = item.amount;
          const itemQuantity = item.quantity;

          // Calculate how many units we can take to fit the target
          const maxUnitsToFit = Math.floor(remainingTarget / itemUnitPrice);

          if (maxUnitsToFit >= itemQuantity) {
            // ================================================================
            // TAKE ENTIRE ITEM (all quantities)
            // ================================================================
            allocatedItems.push(item);
            allocatedAmount += itemTotalAmount;
            remainingTarget -= itemTotalAmount;
            itemPool.shift(); // Remove from pool

            logger.info('Allocated full item', {
              item: `${item.color} ${item.size}`,
              quantity: itemQuantity,
              amount: itemTotalAmount,
              remainingTarget: remainingTarget.toFixed(2)
            });
          } else if (maxUnitsToFit > 0) {
            // ================================================================
            // TAKE PARTIAL QUANTITY FROM THIS ITEM (WHOLE PIECES ONLY)
            // ================================================================
            const partialAmount = parseFloat((maxUnitsToFit * itemUnitPrice).toFixed(2));
            
            // Create partial item for this split
            const partialItem = {
              ...item,
              quantity: maxUnitsToFit, // ✅ Always whole number
              amount: partialAmount
            };

            allocatedItems.push(partialItem);
            allocatedAmount += partialAmount;
            remainingTarget -= partialAmount;

            // Update remaining quantity in pool
            item.quantity -= maxUnitsToFit;
            item.amount = parseFloat((item.quantity * itemUnitPrice).toFixed(2));

            logger.info('Allocated partial item', {
              item: `${item.color} ${item.size}`,
              quantityTaken: maxUnitsToFit,
              quantityRemaining: item.quantity,
              amountTaken: partialAmount,
              remainingTarget: remainingTarget.toFixed(2)
            });

            // If item is fully consumed, remove from pool
            if (item.quantity === 0) {
              itemPool.shift();
            }
          } else {
            // ================================================================
            // ITEM DOESN'T FIT - STOP ALLOCATION FOR THIS SPLIT
            // ================================================================
            logger.info('Item does not fit, stopping allocation', {
              item: `${item.color} ${item.size}`,
              itemUnitPrice,
              remainingTarget: remainingTarget.toFixed(2)
            });
            break;
          }
        }

        logger.info('Regular split allocation completed', {
          splitIndex: i + 1,
          targetAmount,
          actualAmount: allocatedAmount,
          difference: targetTaxable - allocatedAmount,
          itemsAllocated: allocatedItems.length
        });
      }

      // ========================================================================
      // STEP 5: GROUP ALLOCATED ITEMS BACK INTO CHALLANS BY SOURCE
      // ========================================================================
      const challanMap = new Map();

      allocatedItems.forEach(item => {
        const challanKey = item.sourceChallan.number;

        if (!challanMap.has(challanKey)) {
          challanMap.set(challanKey, {
            challanId: item.sourceChallan.id,
            challanNumber: item.sourceChallan.number,
            challanDate: item.sourceChallan.date,
            items: [],
            itemsQty: 0,
            taxableAmount: 0,
            gstAmount: 0,
            totalAmount: 0
          });
        }

        const challan = challanMap.get(challanKey);
        
        // Add item with taxable amounts
        challan.items.push({
          color: item.color,
          size: item.size,
          quantity: item.quantity, // ✅ Whole number
          price: parseFloat(item.price.toFixed(2)), // ✅ Exact price from challan
          amount: parseFloat(item.amount.toFixed(2)) // ✅ Taxable amount
        });

        challan.itemsQty += item.quantity;
        challan.taxableAmount += item.amount;
      });

      // Calculate GST for each challan
      const reconstructedChallans = Array.from(challanMap.values()).map(challan => {
        challan.taxableAmount = parseFloat(challan.taxableAmount.toFixed(2));
        challan.gstAmount = parseFloat((challan.taxableAmount * (gstRate / 100)).toFixed(2));
        challan.totalAmount = parseFloat((challan.taxableAmount + challan.gstAmount).toFixed(2));
        return challan;
      });

      logger.info('Challans reconstructed for split', {
        splitIndex: i + 1,
        originalChallans: parentBill.challans.length,
        reconstructedChallans: reconstructedChallans.length
      });

      // ========================================================================
      // STEP 6: CALCULATE FINANCIALS FOR THIS CHILD BILL
      // ========================================================================
      const totalTaxableAmount = reconstructedChallans.reduce((sum, c) => sum + c.taxableAmount, 0);
      const totalGstAmount = reconstructedChallans.reduce((sum, c) => sum + c.gstAmount, 0);
      const invoiceTotal = totalTaxableAmount + totalGstAmount;

      // Check state for CGST/SGST or IGST
      const buyerState = gstProfile ? gstProfile.stateCode : buyer.stateCode || parentBill.buyer.stateCode || '24';
      const companyState = parentBill.company.address?.stateCode || '24';
      const isSameState = buyerState === companyState;

      const cgst = isSameState ? totalGstAmount / 2 : 0;
      const sgst = isSameState ? totalGstAmount / 2 : 0;
      const igst = !isSameState ? totalGstAmount : 0;

      // ============================================================================
      // STEP 7: GENERATE BILL NUMBER
      // ============================================================================
      let billNumber;

      if (i === 0) {
        // ✅ FIRST CHILD: Use parent's bill number (no gap created)
        billNumber = parentBill.billNumber;
        
        logger.info('First child bill inherits parent bill number', {
          parentBillNumber: parentBill.billNumber,
          childIndex: i + 1
        });
      } else {
        // ✅ OTHER CHILDREN: Generate new sequential bill numbers
        billNumber = await generateBillNumber(organizationId, null, session);
        
        logger.info('New bill number generated for child', {
          childIndex: i + 1,
          newBillNumber: billNumber
        });
      }

      // Calculate financial year
      const startDate = parentBill.billingPeriod.startDate;
      const billMonth = startDate.getMonth();
      const billYear = startDate.getFullYear();
      const financialYear = billMonth < 3 ? billYear - 1 : billYear;
      const financialYearString = `${financialYear}-${(financialYear + 1).toString().slice(-2)}`;

      // Create buyer object with GST profile data
      const billBuyerData = gstProfile ? {
        id: buyer._id,
        name: buyer.name,
        mobile: buyer.mobile,
        email: buyer.email,
        businessName: gstProfile.businessName,
        gstin: gstProfile.gstNumber,
        pan: gstProfile.pan || (gstProfile.gstNumber ? gstProfile.gstNumber.substring(2, 12) : buyer.pan || ''),
        address: gstProfile.address?.fullAddress || gstProfile.address,
        stateCode: gstProfile.stateCode,
        gstProfileId: gstProfile.profileId
      } : {
        id: buyer._id,
        name: buyer.name,
        mobile: buyer.mobile,
        email: buyer.email,
        businessName: buyer.businessName || buyer.name,
        gstin: buyer.gstNumber,
        pan: buyer.pan || (buyer.gstNumber && buyer.gstNumber.length >= 12 ? buyer.gstNumber.substring(2, 12) : ''),
        address: buyer.address,
        stateCode: buyer.stateCode || '24',
        gstProfileId: null
      };

      // ========================================================================
      // STEP 8: CREATE CHILD BILL
      // ========================================================================
      const childBill = await MonthlyBill.create([{
        billNumber,
        financialYear: financialYearString,
        company: parentBill.company,
        buyer: billBuyerData,
        billingPeriod: parentBill.billingPeriod,
        challans: reconstructedChallans,
        financials: {
          totalTaxableAmount: parseFloat(totalTaxableAmount.toFixed(2)),
          cgst: parseFloat(cgst.toFixed(2)),
          sgst: parseFloat(sgst.toFixed(2)),
          igst: parseFloat(igst.toFixed(2)),
          gstRate: gstRate,
          invoiceTotal: parseFloat(invoiceTotal.toFixed(2)),
          previousOutstanding: 0,
          grandTotal: parseFloat(invoiceTotal.toFixed(2)),
          amountPaid: 0,
          balanceDue: parseFloat(invoiceTotal.toFixed(2))
        },
        status: 'draft',
        paymentDueDate: parentBill.paymentDueDate,
        paymentHistory: [],
        hsnCode: parentBill.hsnCode,
        generatedAt: new Date(),
        splitBillInfo: {
          isParent: false,
          isChild: true,
          parentBillId: parentBill._id,
          parentBillNumber: parentBill.billNumber,
          childBillIds: [],
          splitGroupId,
          splitIndex: i + 1,
          totalSplits: splits.length,
          targetAmount: targetAmount,
          actualAmount: parseFloat(invoiceTotal.toFixed(2)),
          variance: parseFloat((invoiceTotal - targetAmount).toFixed(2))
        },
        organizationId,
        tenantId: parentBill.tenantId || organizationId.toString()
      }], { session });

      createdBills.push(childBill[0]);

      // Update GST profile usage count (only for saved profiles)
      if (gstProfile && gstProfile.profileId !== 'original_gst') {
        gstProfile.usageCount = (gstProfile.usageCount || 0) + 1;
        gstProfile.lastUsedAt = new Date();
      }

      logger.info('Child bill created', {
        splitIndex: i + 1,
        billNumber: childBill[0].billNumber,
        targetAmount,
        actualAmount: invoiceTotal,
        variance: invoiceTotal - targetAmount,
        challans: reconstructedChallans.length,
        totalItems: reconstructedChallans.reduce((sum, c) => sum + c.itemsQty, 0)
      });
    }

    // ============================================================================
    // STEP 9: SAVE BUYER WITH UPDATED GST PROFILE USAGE
    // ============================================================================
    await buyer.save({ session });

    await session.commitTransaction();

    // ============================================================================
    // FINAL VERIFICATION LOG
    // ============================================================================
    const totalChildAmount = createdBills.reduce((sum, b) => sum + b.financials.grandTotal, 0);
    const parentAmount = parentBill.financials.grandTotal;

    logger.info('Bill split completed successfully', {
      parentBillNumber: parentBill.billNumber,
      parentAmount,
      childCount: createdBills.length,
      totalChildAmount,
      difference: Math.abs(totalChildAmount - parentAmount),
      splitGroupId
    });

    res.status(201).json({
      success: true,
      message: `Bill split into ${createdBills.length} bills successfully. Original bill deleted.`,
      data: {
        childBills: createdBills.map(b => ({
          id: b._id,
          billNumber: b.billNumber,
          targetAmount: b.splitBillInfo.targetAmount,
          actualAmount: b.financials.grandTotal,
          variance: b.splitBillInfo.variance,
          businessName: b.buyer.businessName,
          gstNumber: b.buyer.gstin,
          gstProfileId: b.buyer.gstProfileId,
          challansCount: b.challans.length,
          totalItems: b.challans.reduce((sum, c) => sum + c.itemsQty, 0)
        })),
        splitGroupId,
        summary: {
          parentAmount,
          totalChildAmount,
          difference: parseFloat((totalChildAmount - parentAmount).toFixed(2))
        }
      }
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Bill split failed', { 
      error: error.message,
      stack: error.stack 
    });
    res.status(500).json({
      success: false,
      message: 'Failed to split bill',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

module.exports = {
  getAllBills,
  getBillById,
  generateBill,
  switchCompany,
  finalizeBill,
  recordPayment,
  recordAdvancePayment,
  getBuyerBills,
  getBillPaymentHistory,
  getBuyerCurrentMonthPending,
  recordPaymentForBill,
  deleteAdvancePayment,
  deleteBill,
  getBillsStats,
  customizeBill,
  deletePaymentFromBill,
  updateBillNumber,
  splitBill
};
