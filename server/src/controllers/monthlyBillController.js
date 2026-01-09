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

// ✅ PERFECT: Generate bill number with REUSE support - finds lowest available number
const generateBillNumber = async (organizationId, session) => {
  try {
    const settings = await Settings.findOne({ organizationId }).session(session);
    const prefix = settings?.billingSettings?.billNumberPrefix || 'VR';

    // Calculate current financial year
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-11
    const currentYear = today.getFullYear();
    const financialYear = currentMonth >= 3 ? currentYear : currentYear - 1; // Apr-Mar cycle

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
      // Reset counter for new FY
      settings.billCounter.currentFinancialYear = financialYear;
      settings.billCounter.currentSequence = 0;
      settings.billCounter.lastResetDate = new Date();
    }

    // ✅ NEW: Get all existing bills for current financial year
    const existingBills = await MonthlyBill.find({
      organizationId,
      financialYear: `${financialYear}-${String(financialYear + 1).slice(-2)}`,
    })
      .select('billNumber')
      .session(session)
      .lean();

    // Extract sequence numbers from existing bills
    const usedNumbers = existingBills
      .map((bill) => {
        // Extract number from format: VR/2025/01 -> 01
        const match = bill.billNumber.match(/\/(\d+)$/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((num) => num !== null)
      .sort((a, b) => a - b);

    // ✅ Find the lowest available number (fill gaps first)
    let billSequence = 1;
    for (const usedNum of usedNumbers) {
      if (usedNum === billSequence) {
        billSequence++; // Number is taken, try next
      } else {
        break; // Found a gap!
      }
    }

    // Update settings counter to highest number for reference (optional)
    settings.billCounter.currentSequence = Math.max(
      billSequence,
      settings.billCounter.currentSequence
    );
    await settings.save({ session });

    // Format: VR/2025/01
    const formattedNumber = `${prefix}/${financialYear}/${String(billSequence).padStart(2, '0')}`;

    logger.info('Bill number generated with reuse support', {
      financialYear,
      billSequence,
      formattedNumber,
      usedNumbers,
    });

    return formattedNumber;
  } catch (error) {
    logger.error('Bill number generation failed', error.message);
    throw error;
  }
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
      }
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
    const previousBills = await MonthlyBill.find({
      organizationId,
      'buyer.id': buyerId,
      status: { $in: ['generated', 'sent', 'partial', 'overdue'] },
      'billingPeriod.endDate': { $lt: startDate }
    }).session(session);

    const previousOutstanding = previousBills.reduce((sum, bill) => sum + bill.financials.balanceDue, 0);

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

    // Generate bill number
    const billNumber = await generateBillNumber(organizationId, session);

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
        pan: buyer.pan,
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

// Delete bill (draft only) - Simple deletion without number recycling
const deleteBill = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
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
        message: 'Can only delete draft bills'
      });
    }

    // Just delete - no number recycling
    await MonthlyBill.findByIdAndDelete(id).session(session);

    await session.commitTransaction();

    logger.info('Bill deleted', {
      billId: id,
      billNumber: bill.billNumber
    });

    res.json({
      success: true,
      message: 'Bill deleted successfully'
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Bill deletion failed:', error.message);
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

// Add this after the generateBill function (around line 250)

// Add this function to monthlyBillController.js

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
  deletePaymentFromBill
};
