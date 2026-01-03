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

// Generate bill number
const generateBillNumber = async (organizationId, month, year) => {
  try {
    const settings = await Settings.findOne({ organizationId });
    const prefix = settings?.billingSettings?.billNumberPrefix || 'VR';
    
    // Format: VR/JAN26/001
    const monthShort = month.substring(0, 3).toUpperCase();
    const yearShort = year.toString().slice(-2);
    
    // Count bills for this month
    const count = await MonthlyBill.countDocuments({
      organizationId,
      'billingPeriod.month': month,
      'billingPeriod.year': year
    });
    
    const billNumber = `${prefix}/${monthShort}${yearShort}/${String(count + 1).padStart(3, '0')}`;
    
    return billNumber;
  } catch (error) {
    logger.error('Bill number generation failed:', error.message);
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

    // ✅ FIX: Check if companies exist, if not create default from existing settings
    let companies = settings.editPermissions?.companies || settings.companies || [];
    
    // If no companies exist, create default company from existing settings
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
      
      // Save to settings for future use
      if (!settings.editPermissions) {
        settings.editPermissions = {};
      }
      settings.editPermissions.companies = companies;
      
      // Also create billingSettings if doesn't exist
      if (!settings.editPermissions.billingSettings) {
        settings.editPermissions.billingSettings = {
          autoGenerateBills: true,
          billGenerationDay: 31,
          paymentTermDays: 30,
          defaultCompanyId: 'company1',
          hsnCode: '6203',
          gstRate: settings.gstPercentage || 5,
          billNumberPrefix: 'VR'
        };
      }
      
      await settings.save({ session });
      
      logger.info('Created default company from existing settings', {
        organizationId,
        companyName: defaultCompany.name
      });
    }

    // Get company details
    const billingSettings = settings.editPermissions?.billingSettings || {
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
        message: 'Company details not found. Using default company from settings.'
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

      return {
        challanId: order._id,
        challanNumber: order.challanNumber,
        challanDate: order.createdAt,
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
    const buyerState = buyer.address?.stateCode || company.address?.stateCode || '24';
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

    const grandTotal = invoiceTotal + previousOutstanding;

    // Generate bill number
    const billNumber = await generateBillNumber(organizationId, month, year);

    // Calculate financial year
    const financialYear = year + '-' + (year + 1).toString().slice(-2);

    // Calculate due date
    const paymentTermDays = billingSettings.paymentTermDays || 30;
    const paymentDueDate = new Date(endDate);
    paymentDueDate.setDate(paymentDueDate.getDate() + paymentTermDays);

    // Create bill
    const bill = await MonthlyBill.create([{
      billNumber,
      financialYear,
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
        amountPaid: 0,
        balanceDue: parseFloat(grandTotal.toFixed(2))
      },
      status: 'draft',
      paymentDueDate,
      hsnCode: billingSettings.hsnCode || '6203',
      organizationId
    }], { session });

    await session.commitTransaction();

    // ✅ NEW: Auto-finalize if only one active company
    const activeCompanies = companies.filter(c => c.isActive !== false);
    if (activeCompanies.length === 1) {
    bill[0].status = 'generated';
    bill[0].finalizedAt = new Date();
    await bill[0].save();
    
    logger.info('Bill auto-finalized (single company)', {
        billId: bill[0]._id,
        billNumber
    });
    }

    logger.info('Bill generated successfully', {
      billId: bill[0]._id,
      billNumber,
      buyer: buyer.name
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

// Delete bill (draft only)
const deleteBill = async (req, res) => {
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
        message: 'Can only delete draft bills'
      });
    }

    await MonthlyBill.findByIdAndDelete(id);

    logger.info('Bill deleted', {
      billId: id,
      billNumber: bill.billNumber
    });

    res.json({
      success: true,
      message: 'Bill deleted successfully'
    });

  } catch (error) {
    logger.error('Bill deletion failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to delete bill',
      error: error.message
    });
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

// ✅ NEW: Customize bill before finalizing
const customizeBill = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { companyId, paymentTermDays, hsnCode, notes, removeChallans } = req.body;
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
        message: 'Can only customize draft bills'
      });
    }

    // Get settings for company details
    const settings = await Settings.findOne({ organizationId }).session(session);
    const companies = settings?.editPermissions?.companies || settings?.companies || [];

    // Update company if provided
    if (companyId) {
      const company = companies.find(c => c.id === companyId);
      if (company) {
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
      }
    }

    // Update payment terms
    if (paymentTermDays) {
      const newDueDate = new Date(bill.billingPeriod.endDate);
      newDueDate.setDate(newDueDate.getDate() + parseInt(paymentTermDays));
      bill.paymentDueDate = newDueDate;
    }

    // Update HSN code
    if (hsnCode) {
      bill.hsnCode = hsnCode;
    }

    // Add notes
    if (notes) {
      bill.notes = notes;
    }

    // Remove specific challans if requested
    if (removeChallans && Array.isArray(removeChallans)) {
      bill.challans = bill.challans.filter(c => !removeChallans.includes(c.challanId.toString()));
      
      // Recalculate financials
      const totalTaxableAmount = bill.challans.reduce((sum, c) => sum + c.taxableAmount, 0);
      const totalGstAmount = bill.challans.reduce((sum, c) => sum + c.gstAmount, 0);
      const invoiceTotal = bill.challans.reduce((sum, c) => sum + c.totalAmount, 0);
      
      const buyerState = bill.buyer.stateCode || bill.company.address?.stateCode || '24';
      const companyState = bill.company.address?.stateCode || '24';
      const isSameState = buyerState === companyState;
      
      const cgst = isSameState ? totalGstAmount / 2 : 0;
      const sgst = isSameState ? totalGstAmount / 2 : 0;
      const igst = !isSameState ? totalGstAmount : 0;
      
      const grandTotal = invoiceTotal + bill.financials.previousOutstanding;
      
      bill.financials.totalTaxableAmount = parseFloat(totalTaxableAmount.toFixed(2));
      bill.financials.cgst = parseFloat(cgst.toFixed(2));
      bill.financials.sgst = parseFloat(sgst.toFixed(2));
      bill.financials.igst = parseFloat(igst.toFixed(2));
      bill.financials.invoiceTotal = parseFloat(invoiceTotal.toFixed(2));
      bill.financials.grandTotal = parseFloat(grandTotal.toFixed(2));
      bill.financials.balanceDue = parseFloat(grandTotal.toFixed(2));
    }

    await bill.save({ session });
    await session.commitTransaction();

    logger.info('Bill customized', {
      billId: bill._id,
      billNumber: bill.billNumber
    });

    res.json({
      success: true,
      message: 'Bill customized successfully',
      data: bill
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error('Bill customization failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to customize bill',
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
  deleteBill,
  getBillsStats,
  customizeBill
};
