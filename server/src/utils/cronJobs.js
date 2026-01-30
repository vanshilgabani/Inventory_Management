const cron = require('node-cron');
const logger = require('./logger');
const { expireOldRequests } = require('../controllers/pendingRequestController');

// Import for auto bill generation
const mongoose = require('mongoose');
const MonthlyBill = require('../models/MonthlyBill');
const WholesaleBuyer = require('../models/WholesaleBuyer');
const WholesaleOrder = require('../models/WholesaleOrder');
const Settings = require('../models/Settings');

const initCronJobs = () => {
  
  // ========================================
  // AUTO BILL GENERATION - Last day of month at 11:59 PM IST
  // ========================================
  cron.schedule('59 23 28-31 * *', async () => {
    console.log('🔔 Running Auto Bill Generation Job...');
    logger.info('Auto Bill Generation Job Started');
    
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Check if tomorrow is the 1st day of next month (meaning today is last day)
      if (tomorrow.getDate() !== 1) {
        console.log('⏭️  Not the last day of month, skipping...');
        return;
      }
      
      console.log('✅ Last day of month detected! Generating bills for all organizations...');
      
      // Get current month and year
      const currentMonth = today.toLocaleString('en-US', { month: 'long' });
      const currentYear = today.getFullYear();
      
      console.log(`📅 Billing Period: ${currentMonth} ${currentYear}`);
      
      // Get all unique organizations
      const organizations = await Settings.distinct('organizationId');
      console.log(`🏢 Found ${organizations.length} organizations`);
      
      let totalGenerated = 0;
      let totalSkipped = 0;
      let totalFailed = 0;
      const errorLog = [];
      
      // Process each organization
      for (const organizationId of organizations) {
        const session = await mongoose.startSession();
        
        try {
          session.startTransaction();
          
          console.log(`\n🏢 Processing Organization: ${organizationId}`);
          
          // Get settings for this organization
          const settings = await Settings.findOne({ organizationId }).session(session);
          
          if (!settings) {
            console.log(`⚠️  No settings found for org: ${organizationId}`);
            totalSkipped++;
            await session.abortTransaction();
            continue;
          }
          
          // Check if auto-generation is enabled
          if (!settings?.billingSettings?.autoGenerateBills) {
            console.log(`⏭️  Auto-generation disabled for org: ${organizationId}`);
            totalSkipped++;
            await session.abortTransaction();
            continue;
          }
          
          // Get all buyers for this organization who have orders this month
          const startDate = new Date(currentYear, getMonthNumber(currentMonth), 1);
          const endDate = new Date(currentYear, getMonthNumber(currentMonth) + 1, 0, 23, 59, 59);
          
          // Find buyers who have orders in this period
          const buyersWithOrders = await WholesaleOrder.distinct('buyerId', {
            organizationId,
            createdAt: { $gte: startDate, $lte: endDate }
          }).session(session);
          
          console.log(`👥 Found ${buyersWithOrders.length} buyers with orders in ${currentMonth} ${currentYear}`);
          
          if (buyersWithOrders.length === 0) {
            console.log(`⏭️  No orders found for this month, skipping org: ${organizationId}`);
            totalSkipped++;
            await session.abortTransaction();
            continue;
          }
          
          // Get default company
          const companies = settings.companies || [];
          const activeCompanies = companies.filter(c => c.isActive !== false);
          let companyId = null;
          
          if (activeCompanies.length > 0) {
            const defaultCompany = activeCompanies.find(c => c.isDefault);
            companyId = defaultCompany ? defaultCompany.id : activeCompanies[0].id;
          }
          
          if (!companyId) {
            console.log(`⚠️  No active company found for org: ${organizationId}`);
            totalSkipped++;
            await session.abortTransaction();
            continue;
          }
          
          let orgGenerated = 0;
          let orgFailed = 0;
          
          // Generate bill for each buyer with orders
          for (const buyerId of buyersWithOrders) {
            try {
              // Get buyer details
              const buyer = await WholesaleBuyer.findOne({ 
                _id: buyerId, 
                organizationId 
              }).session(session);
              
              if (!buyer) {
                console.log(`⚠️  Buyer ${buyerId} not found, skipping...`);
                continue;
              }
              
              // Check if bill already exists
              const existingBill = await MonthlyBill.findOne({
                organizationId,
                'buyer.id': buyerId,
                'billingPeriod.month': currentMonth,
                'billingPeriod.year': currentYear
              }).session(session);
              
              if (existingBill) {
                console.log(`⏭️  Bill already exists for ${buyer.name} (${existingBill.billNumber})`);
                continue;
              }
              
              // Get orders for this buyer in this period
              const orders = await WholesaleOrder.find({
                buyerId: buyer._id,
                organizationId,
                createdAt: { $gte: startDate, $lte: endDate }
              })
              .sort({ createdAt: 1 })
              .session(session);
              
              if (orders.length === 0) {
                console.log(`⏭️  No orders for ${buyer.name}, skipping...`);
                continue;
              }
              
              // Build challans array
              const gstRate = settings.billingSettings?.gstRate || settings.gstPercentage || 5;
              const challans = orders.map(order => {
                const itemsQty = order.items.reduce((sum, item) => sum + item.quantity, 0);
                const taxableAmount = order.totalAmount / (1 + gstRate / 100);
                const gstAmount = order.totalAmount - taxableAmount;
                
                const itemsWithTaxableAmounts = order.items.map(item => {
                  const qty = item.quantity || 0;
                  const price = item.pricePerUnit || 0;
                  return {
                    color: item.color,
                    size: item.size,
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
              const company = companies.find(c => c.id === companyId);
              const buyerState = buyer.stateCode || company?.address?.stateCode || 24;
              const companyState = company?.address?.stateCode || 24;
              const isSameState = buyerState === companyState;
              
              const cgst = isSameState ? totalGstAmount / 2 : 0;
              const sgst = isSameState ? totalGstAmount / 2 : 0;
              const igst = !isSameState ? totalGstAmount : 0;
              
              // Get previous outstanding
              const previousBills = await MonthlyBill.find({
                organizationId,
                'buyer.id': buyerId,
                status: { $in: ['generated', 'sent', 'partial', 'overdue'] },
                'billingPeriod.endDate': { $lt: startDate }
              }).session(session);
              
              const previousOutstanding = previousBills.reduce((sum, bill) => 
                sum + bill.financials.balanceDue, 0
              );
              
              // Check for challan payments
              const challanIds = challans.map(c => c.challanId);
              const ordersWithPayments = await WholesaleOrder.find({
                _id: { $in: challanIds },
                organizationId
              }).session(session);
              
              let totalPaidFromChallans = 0;
              const paymentHistoryFromChallans = [];
              
              for (const order of ordersWithPayments) {
                totalPaidFromChallans += order.amountPaid || 0;
                
                if (order.paymentHistory && order.paymentHistory.length > 0) {
                  order.paymentHistory.forEach(payment => {
                    paymentHistoryFromChallans.push({
                      amount: payment.amount,
                      paymentDate: payment.paymentDate,
                      paymentMethod: payment.paymentMethod,
                      notes: `Payment for challan ${order.challanNumber}`,
                      recordedBy: 'System',
                      recordedByRole: 'system'
                    });
                  });
                }
              }
              
              // Calculate grand total and balance
              const grandTotal = invoiceTotal + previousOutstanding;
              const amountPaid = totalPaidFromChallans;
              const balanceDue = Math.max(0, grandTotal - amountPaid);
              
              // Determine status
              let status;
              if (balanceDue <= 0) {
                status = 'paid';
              } else if (amountPaid > 0) {
                status = 'partial';
              } else {
                status = 'generated';
              }
              
              // Generate bill number
              const billNumber = await generateBillNumber(organizationId, session);
              
              // Calculate financial year
              const billMonth = startDate.getMonth(); // 0-11
              const billYear = startDate.getFullYear();
              const financialYear = billMonth >= 3 ? billYear : billYear - 1;
              const financialYearString = `${financialYear}-${String(financialYear + 1).slice(-2)}`;
              
              // Calculate due date
              const paymentTermDays = settings.billingSettings?.paymentTermDays || 30;
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
                  month: currentMonth,
                  year: currentYear,
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
                  amountPaid: parseFloat(amountPaid.toFixed(2)),
                  balanceDue: parseFloat(balanceDue.toFixed(2))
                },
                status,
                paymentDueDate,
                paymentHistory: paymentHistoryFromChallans,
                hsnCode: settings.billingSettings?.hsnCode || '6203',
                organizationId,
                finalizedAt: status !== 'draft' ? new Date() : null
              }], { session });
              
              // Update buyer's monthly bills
              if (!buyer.monthlyBills) buyer.monthlyBills = [];
              
              buyer.monthlyBills.push({
                billId: bill[0]._id,
                billNumber,
                month: currentMonth,
                year: currentYear,
                invoiceTotal: parseFloat(invoiceTotal.toFixed(2)),
                amountPaid: parseFloat(amountPaid.toFixed(2)),
                balanceDue: parseFloat(balanceDue.toFixed(2)),
                status,
                generatedAt: new Date()
              });
              
              // Recalculate buyer's totals
              buyer.totalDue = buyer.monthlyBills.reduce((sum, b) => sum + b.balanceDue, 0);
              buyer.totalPaid = buyer.monthlyBills.reduce((sum, b) => sum + b.amountPaid, 0);
              
              await buyer.save({ session });
              
              orgGenerated++;
              console.log(`✅ Bill ${billNumber} generated for ${buyer.name} - ₹${grandTotal.toFixed(2)}`);
              
            } catch (buyerError) {
              orgFailed++;
              const buyer = await WholesaleBuyer.findById(buyerId);
              const errorMsg = `Failed for ${buyer?.name || buyerId}: ${buyerError.message}`;
              console.error(`❌ ${errorMsg}`);
              errorLog.push({ organizationId, buyerId, error: buyerError.message });
            }
          }
          
          await session.commitTransaction();
          
          totalGenerated += orgGenerated;
          totalFailed += orgFailed;
          
          console.log(`✅ Org ${organizationId} Complete: ${orgGenerated} generated, ${orgFailed} failed`);
          
        } catch (orgError) {
          await session.abortTransaction();
          console.error(`❌ Error processing org ${organizationId}:`, orgError.message);
          totalFailed++;
          errorLog.push({ organizationId, error: orgError.message });
        } finally {
          session.endSession();
        }
      }
      
      console.log('\n' + '='.repeat(60));
      console.log('🎉 AUTO BILL GENERATION COMPLETE!');
      console.log('='.repeat(60));
      console.log(`✅ Bills Generated: ${totalGenerated}`);
      console.log(`⏭️  Skipped: ${totalSkipped}`);
      console.log(`❌ Failed: ${totalFailed}`);
      console.log('='.repeat(60));
      
      logger.info('Auto Bill Generation Complete', {
        month: currentMonth,
        year: currentYear,
        totalGenerated,
        totalSkipped,
        totalFailed,
        errors: errorLog
      });
      
    } catch (error) {
      console.error('❌ CRITICAL ERROR in Auto Bill Generation Job:', error);
      logger.error('Auto Bill Generation Job Critical Failure', { 
        error: error.message, 
        stack: error.stack 
      });
    }
  }, {
    timezone: 'Asia/Kolkata'
  });

  // ========================================
  // EXPIRE OLD PENDING REQUESTS - Every hour
  // ========================================
  cron.schedule('0 * * * *', async () => {
    logger.info('Running cron: Expire old pending requests');
    try {
      const expiredCount = await expireOldRequests();
      logger.info(`Cron completed: Expired ${expiredCount} requests`);
    } catch (error) {
      logger.error('Cron failed: Expire old requests', error.message);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log('✅ CRON JOBS INITIALIZED');
  console.log('='.repeat(60));
  console.log('📅 Auto Bill Generation: Last day of month at 11:59 PM IST');
  console.log('⏰ Expire Old Requests: Every hour');
  console.log('='.repeat(60) + '\n');
};

// ========================================
// CHECK SUBSCRIPTION EXPIRY - Daily at 12:00 AM IST
// ========================================
cron.schedule('0 0 * * *', async () => {
  console.log('🔔 Running Subscription Expiry Check...');
  logger.info('Subscription Expiry Check Started');
  
  try {
    const Subscription = require('../models/Subscription');
    const Notification = require('../models/Notification');
    const today = new Date();
    
    // Find expiring/expired subscriptions
    const subscriptions = await Subscription.find({
      status: { $in: ['trial', 'active'] }
    });
    
    let expiryCount = 0;
    let warningCount = 0;
    
    for (const sub of subscriptions) {
      const endDate = sub.planType === 'trial' ? sub.trialEndDate : sub.yearlyEndDate;
      const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
      
      // Expired
      if (daysLeft <= 0) {
        sub.status = 'expired';
        await sub.save();
        expiryCount++;
        
        await Notification.create({
          userId: sub.userId,
          type: 'alert',
          category: 'subscription-expired',
          title: 'Subscription Expired',
          message: 'Your subscription has expired. Please renew to continue.',
          priority: 'high',
          read: false,
          organizationId: sub.userId
        });
      }
      // Warning (7 days before expiry)
      else if (daysLeft <= 7 && daysLeft > 0) {
        warningCount++;
        
        await Notification.create({
          userId: sub.userId,
          type: 'warning',
          category: 'subscription-expiring',
          title: 'Subscription Expiring Soon',
          message: `Your subscription expires in ${daysLeft} days. Please renew.`,
          priority: 'medium',
          read: false,
          organizationId: sub.userId
        });
      }
    }
    
    console.log(`✅ Subscription Check Complete: ${expiryCount} expired, ${warningCount} warnings sent`);
    logger.info('Subscription Expiry Check Complete', { expiryCount, warningCount });
    
  } catch (error) {
    console.error('❌ Subscription expiry check failed:', error);
    logger.error('Subscription expiry check failed', { error: error.message });
  }
}, {
  timezone: 'Asia/Kolkata'
});

// Helper function to generate bill number
const generateBillNumber = async (organizationId, session) => {
  try {
    const settings = await Settings.findOne({ organizationId }).session(session);
    const prefix = settings?.billingSettings?.billNumberPrefix || 'VR';
    
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-11
    const currentYear = today.getFullYear();
    const financialYear = currentMonth >= 3 ? currentYear : currentYear - 1;
    
    if (!settings.billCounter) {
      settings.billCounter = {
        currentFinancialYear: financialYear,
        currentSequence: 0,
        lastResetDate: new Date()
      };
    }
    
    if (settings.billCounter.currentFinancialYear !== financialYear) {
      settings.billCounter.currentFinancialYear = financialYear;
      settings.billCounter.currentSequence = 0;
      settings.billCounter.lastResetDate = new Date();
    }
    
    const existingBills = await MonthlyBill.find({
      organizationId,
      financialYear: `${financialYear}-${String(financialYear + 1).slice(-2)}`
    })
    .select('billNumber')
    .session(session)
    .lean();
    
    const usedNumbers = existingBills
      .map(bill => {
        const match = bill.billNumber.match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter(num => num !== null)
      .sort((a, b) => a - b);
    
    let billSequence = 1;
    for (const usedNum of usedNumbers) {
      if (usedNum === billSequence) {
        billSequence++;
      } else {
        break;
      }
    }
    
    settings.billCounter.currentSequence = Math.max(
      billSequence,
      settings.billCounter.currentSequence
    );
    
    await settings.save({ session });
    
    const formattedNumber = `${prefix}${financialYear}${String(billSequence).padStart(2, '0')}`;
    
    return formattedNumber;
  } catch (error) {
    logger.error('Bill number generation failed', error.message);
    throw error;
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

module.exports =  initCronJobs;
