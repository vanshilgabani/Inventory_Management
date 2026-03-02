/**
 * INTERACTIVE MIGRATION SCRIPT: Fix Challan Payments
 * 
 * Phase 1: Analyze and show what will be changed
 * Phase 2: Wait for user confirmation (yes/no)
 * Phase 3: Apply changes only if confirmed
 * 
 * Usage: node scripts/fixChallanPayments.js
 */

const mongoose = require('mongoose');
const readline = require('readline');
require('dotenv').config();

// Import models
const MonthlyBill = require('../models/MonthlyBill');
const WholesaleOrder = require('../models/WholesaleOrder');

// Setup readline for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Connected\n');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

/**
 * Calculate cumulative payments for all challans in a buyer's period
 */
const calculateChallanPayments = async (organizationId, buyerId, month, year) => {
  try {
    // Find ALL bills for this buyer + period
    const bills = await MonthlyBill.find({
      organizationId,
      'buyer.id': buyerId,
      'billingPeriod.month': month,
      'billingPeriod.year': year
    });

    if (bills.length === 0) {
      return { challans: new Map(), billCount: 0 };
    }

    // Build cumulative payment map
    const challanPaymentMap = new Map();

    for (const bill of bills) {
      const billPaidRatio = bill.financials.grandTotal > 0 
        ? bill.financials.amountPaid / bill.financials.grandTotal 
        : 0;

      for (const challan of bill.challans) {
        if (!challan.challanId) continue;

        const challanId = challan.challanId.toString();

        if (!challanPaymentMap.has(challanId)) {
          challanPaymentMap.set(challanId, {
            challanNumber: challan.challanNumber,
            totalInBills: 0,
            totalPaid: 0,
            bills: []
          });
        }

        const info = challanPaymentMap.get(challanId);
        info.totalInBills += challan.totalAmount;
        info.totalPaid += (challan.totalAmount * billPaidRatio);
        info.bills.push({
          billNumber: bill.billNumber,
          billAmount: challan.totalAmount,
          billPaid: (challan.totalAmount * billPaidRatio),
          billStatus: bill.status,
          billPaidRatio: (billPaidRatio * 100).toFixed(2) + '%'
        });
      }
    }

    return { challans: challanPaymentMap, billCount: bills.length };

  } catch (error) {
    console.error(`  ❌ Error calculating challan payments:`, error.message);
    throw error;
  }
};

/**
 * Analyze what changes would be made (dry run)
 */
const analyzeChanges = async (challanId, paymentInfo) => {
  try {
    const order = await WholesaleOrder.findById(challanId);
    if (!order) {
      return { 
        found: false, 
        challanId 
      };
    }

    // Calculate final amounts
    const totalPaid = Math.min(
      Math.round(paymentInfo.totalPaid * 100) / 100,
      order.totalAmount
    );
    const totalDue = Math.max(0, order.totalAmount - totalPaid);

    // Determine payment status
    let newStatus;
    if (totalDue <= 0) {
      newStatus = 'Paid';
    } else if (totalPaid > 0) {
      newStatus = 'Partial';
    } else {
      newStatus = 'Pending';
    }

    // Check if update needed
    const statusChanged = order.paymentStatus !== newStatus;
    const amountChanged = Math.abs(order.amountPaid - totalPaid) > 0.01;
    const needsUpdate = statusChanged || amountChanged;

    return {
      found: true,
      needsUpdate,
      challanNumber: order.challanNumber,
      buyerName: order.buyerName || order.businessName,
      challanDate: order.createdAt,
      currentStatus: order.paymentStatus,
      newStatus: newStatus,
      currentPaid: order.amountPaid,
      newPaid: totalPaid,
      currentDue: order.amountDue,
      newDue: totalDue,
      totalAmount: order.totalAmount,
      statusChanged,
      amountChanged,
      billDetails: paymentInfo.bills
    };

  } catch (error) {
    console.error(`    ❌ Error analyzing challan ${challanId}:`, error.message);
    return { found: false, error: error.message };
  }
};

/**
 * Update a single WholesaleOrder with payment info
 */
const updateChallanPayment = async (challanId, paymentInfo) => {
  try {
    const order = await WholesaleOrder.findById(challanId);
    if (!order) {
      return { updated: false, reason: 'not_found' };
    }

    // Calculate final amounts
    const totalPaid = Math.min(
      Math.round(paymentInfo.totalPaid * 100) / 100,
      order.totalAmount
    );
    const totalDue = Math.max(0, order.totalAmount - totalPaid);

    // Determine payment status
    let newStatus;
    if (totalDue <= 0) {
      newStatus = 'Paid';
    } else if (totalPaid > 0) {
      newStatus = 'Partial';
    } else {
      newStatus = 'Pending';
    }

    // Update order
    const oldStatus = order.paymentStatus;
    const oldPaid = order.amountPaid;

    order.amountPaid = totalPaid;
    order.amountDue = totalDue;
    order.paymentStatus = newStatus;

    // Add payment history entry
    const amountChanged = Math.abs(oldPaid - totalPaid) > 0.01;
    if (amountChanged) {
      order.paymentHistory.push({
        amount: totalPaid - oldPaid,
        paymentDate: new Date(),
        paymentMethod: 'Bill Payment',
        notes: `Migration: Fixed cumulative payment. Total paid: ₹${totalPaid.toFixed(2)} of ₹${order.totalAmount.toFixed(2)}`,
        recordedBy: 'Migration Script'
      });
    }

    await order.save();

    return {
      updated: true,
      challanNumber: order.challanNumber,
      oldStatus,
      newStatus,
      oldPaid: oldPaid.toFixed(2),
      newPaid: totalPaid.toFixed(2)
    };

  } catch (error) {
    console.error(`    ❌ Error updating challan ${challanId}:`, error.message);
    return { updated: false, reason: 'error', error: error.message };
  }
};

/**
 * Ask user for confirmation
 */
const askConfirmation = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase().trim());
    });
  });
};

/**
 * PHASE 1: Analyze what will change
 */
const analyzeAllChanges = async () => {
  try {
    console.log('🔍 PHASE 1: ANALYZING CHANGES\n');
    console.log('='.repeat(80) + '\n');

    // Find all bills that have payments recorded
    const billsWithPayments = await MonthlyBill.find({
      'financials.amountPaid': { $gt: 0 }
    }).sort({ createdAt: 1 });

    console.log(`📊 Found ${billsWithPayments.length} bills with payments recorded\n`);

    if (billsWithPayments.length === 0) {
      console.log('✅ No bills with payments found. Nothing to migrate.\n');
      return { changes: [], summary: { total: 0, toUpdate: 0, alreadyCorrect: 0 } };
    }

    // Group bills by buyer + period
    const periodMap = new Map();

    for (const bill of billsWithPayments) {
      const key = `${bill.organizationId}_${bill.buyer.id}_${bill.billingPeriod.month}_${bill.billingPeriod.year}`;
      
      if (!periodMap.has(key)) {
        periodMap.set(key, {
          organizationId: bill.organizationId,
          buyerId: bill.buyer.id,
          buyerName: bill.buyer.name,
          month: bill.billingPeriod.month,
          year: bill.billingPeriod.year
        });
      }
    }

    console.log(`📅 Found ${periodMap.size} unique buyer+period combinations\n`);

    // Analyze each period
    const allChanges = [];
    let totalChallans = 0;
    let challansToUpdate = 0;
    let challansAlreadyCorrect = 0;
    let periodCount = 0;

    for (const [key, period] of periodMap) {
      periodCount++;
      console.log(`\n[${ periodCount}/${periodMap.size}] Analyzing: ${period.buyerName} - ${period.month} ${period.year}`);
      console.log('-'.repeat(80));

      try {
        // Calculate cumulative payments
        const { challans, billCount } = await calculateChallanPayments(
          period.organizationId,
          period.buyerId,
          period.month,
          period.year
        );

        console.log(`  📋 ${billCount} bill(s), ${challans.size} unique challan(s)\n`);

        if (challans.size === 0) {
          console.log('  ⚠️  No challans found\n');
          continue;
        }

        // Analyze each challan
        for (const [challanId, paymentInfo] of challans) {
          const analysis = await analyzeChanges(challanId, paymentInfo);

          if (!analysis.found) {
            console.log(`  ⚠️  Challan ${challanId} not found in database\n`);
            continue;
          }

          totalChallans++;

          if (analysis.needsUpdate) {
            challansToUpdate++;
            allChanges.push({
              period: `${period.buyerName} - ${period.month} ${period.year}`,
              ...analysis
            });

            // Display change details
            console.log(`  ${challansToUpdate}. ${analysis.challanNumber} (${analysis.buyerName})`);
            console.log(`     Date: ${new Date(analysis.challanDate).toLocaleDateString('en-IN')}`);
            console.log(`     Total Amount: ₹${analysis.totalAmount.toFixed(2)}`);
            console.log(`     Status Change: ${analysis.currentStatus} → ${analysis.newStatus}`);
            console.log(`     Paid Amount: ₹${analysis.currentPaid.toFixed(2)} → ₹${analysis.newPaid.toFixed(2)}`);
            console.log(`     Due Amount: ₹${analysis.currentDue.toFixed(2)} → ₹${analysis.newDue.toFixed(2)}`);
            console.log(`     Payment from ${analysis.billDetails.length} bill(s):`);
            analysis.billDetails.forEach(bill => {
              console.log(`       - ${bill.billNumber}: ₹${bill.billPaid.toFixed(2)} (${bill.billPaidRatio} paid)`);
            });
            console.log('');
          } else {
            challansAlreadyCorrect++;
            console.log(`  ✓ ${analysis.challanNumber}: Already correct (${analysis.currentStatus}, ₹${analysis.currentPaid.toFixed(2)} paid)`);
          }
        }

      } catch (error) {
        console.error(`  ❌ Error analyzing period:`, error.message);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 ANALYSIS SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Challans Analyzed: ${totalChallans}`);
    console.log(`Challans to Update: ${challansToUpdate}`);
    console.log(`Challans Already Correct: ${challansAlreadyCorrect}`);
    console.log('='.repeat(80) + '\n');

    return {
      changes: allChanges,
      summary: {
        total: totalChallans,
        toUpdate: challansToUpdate,
        alreadyCorrect: challansAlreadyCorrect
      }
    };

  } catch (error) {
    console.error('\n❌ Analysis failed:', error.message);
    throw error;
  }
};

/**
 * PHASE 2: Apply changes
 */
const applyChanges = async (changes) => {
  try {
    console.log('\n🔧 PHASE 2: APPLYING CHANGES\n');
    console.log('='.repeat(80) + '\n');

    let successCount = 0;
    let failCount = 0;

    // Re-calculate and update each period
    const processedPeriods = new Set();

    for (const change of changes) {
      const periodKey = change.period;

      // Skip if we already processed this period
      if (processedPeriods.has(periodKey)) continue;
      processedPeriods.add(periodKey);

      console.log(`Processing: ${periodKey}`);

      // Find all bills for this period
      const billsWithPayments = await MonthlyBill.find({
        'financials.amountPaid': { $gt: 0 }
      });

      // Group and process
      const periodMap = new Map();
      for (const bill of billsWithPayments) {
        const key = `${bill.organizationId}_${bill.buyer.id}_${bill.billingPeriod.month}_${bill.billingPeriod.year}`;
        if (!periodMap.has(key)) {
          periodMap.set(key, {
            organizationId: bill.organizationId,
            buyerId: bill.buyer.id,
            month: bill.billingPeriod.month,
            year: bill.billingPeriod.year
          });
        }
      }

      for (const [key, period] of periodMap) {
        const { challans } = await calculateChallanPayments(
          period.organizationId,
          period.buyerId,
          period.month,
          period.year
        );

        // Update each challan
        for (const [challanId, paymentInfo] of challans) {
          const result = await updateChallanPayment(challanId, paymentInfo);

          if (result.updated) {
            successCount++;
            console.log(`  ✅ ${result.challanNumber}: ${result.oldStatus} → ${result.newStatus} (₹${result.oldPaid} → ₹${result.newPaid})`);
          } else if (result.reason === 'error') {
            failCount++;
            console.log(`  ❌ Error: ${result.error}`);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 UPDATE SUMMARY');
    console.log('='.repeat(80));
    console.log(`Successfully Updated: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log('='.repeat(80) + '\n');

    return { successCount, failCount };

  } catch (error) {
    console.error('\n❌ Update failed:', error.message);
    throw error;
  }
};

/**
 * Main execution
 */
const main = async () => {
  try {
    await connectDB();

    // PHASE 1: Analyze
    const { changes, summary } = await analyzeAllChanges();

    if (summary.toUpdate === 0) {
      console.log('✅ No changes needed. All challans are already correct!\n');
      rl.close();
      process.exit(0);
      return;
    }

    // Ask for confirmation
    console.log(`\n⚠️  This will update ${summary.toUpdate} challan(s).\n`);
    const answer = await askConfirmation('Do you want to proceed with these changes? (yes/no): ');

    if (answer === 'yes' || answer === 'y') {
      // PHASE 2: Apply changes
      const result = await applyChanges(changes);
      
      if (result.successCount > 0) {
        console.log('✅ Migration completed successfully!\n');
      }
    } else {
      console.log('\n❌ Migration cancelled by user. No changes were made.\n');
    }

    rl.close();
    process.exit(0);

  } catch (error) {
    console.error('\n💥 Script failed:', error.message);
    console.error(error.stack);
    rl.close();
    process.exit(1);
  }
};

// Run the script
main();
