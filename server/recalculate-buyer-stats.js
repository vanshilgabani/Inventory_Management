// recalculate-buyer-stats.js
require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

// Get MongoDB URI from .env
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;

if (!MONGO_URI) {
  console.error('❌ Error: MongoDB URI not found in .env file');
  process.exit(1);
}

// Import models
const WholesaleBuyer = require('../server/src/models/WholesaleBuyer');
const MonthlyBill = require('../server/src/models/MonthlyBill');
const WholesaleOrder = require('../server/src/models/WholesaleOrder');

// Create readline interface for confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Prompt for confirmation
const askConfirmation = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase() === 'yes');
    });
  });
};

async function recalculateBuyerStats() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all buyers
    const buyers = await WholesaleBuyer.find({}).lean();
    
    if (buyers.length === 0) {
      console.log('ℹ️  No buyers found in database');
      await mongoose.disconnect();
      rl.close();
      return;
    }

    console.log(`📊 Found ${buyers.length} buyers\n`);
    console.log('🔍 Analyzing data discrepancies...\n');

    const updates = [];
    
    for (const buyer of buyers) {
      const buyerId = buyer._id;
      
      // STEP 1: Get all monthly bills for this buyer
      const bills = await MonthlyBill.find({
        'buyer.id': buyerId,
        organizationId: buyer.organizationId
      }).lean();

      // STEP 2: Get all wholesale orders (challans) for this buyer
      const orders = await WholesaleOrder.find({
        buyerId: buyerId,
        organizationId: buyer.organizationId
      }).lean();

      // STEP 3: Calculate correct totals from bills (primary source)
      let correctMonthlyBills = [];
      let newTotalDue = 0;
      let newTotalPaid = 0;
      let newTotalSpent = 0;
      let newTotalOrders = 0;

      if (bills.length > 0) {
        // Use bill-based calculation
        correctMonthlyBills = bills.map(bill => ({
          billId: bill._id,
          billNumber: bill.billNumber,
          month: bill.billingPeriod.month,
          year: bill.billingPeriod.year,
          invoiceTotal: bill.financials.invoiceTotal || 0,
          amountPaid: bill.financials.amountPaid || 0,
          balanceDue: bill.financials.balanceDue || 0,
          status: bill.status,
          generatedAt: bill.generatedAt || bill.createdAt
        }));

        newTotalDue = bills.reduce((sum, b) => sum + (b.financials?.balanceDue || 0), 0);
        newTotalPaid = bills.reduce((sum, b) => sum + (b.financials?.amountPaid || 0), 0);
        newTotalSpent = bills.reduce((sum, b) => sum + (b.financials?.invoiceTotal || 0), 0);
        newTotalOrders = bills.length;
      } else {
        // Fallback to order-based calculation (legacy)
        newTotalDue = orders.reduce((sum, o) => sum + (o.amountDue || 0), 0);
        newTotalPaid = orders.reduce((sum, o) => sum + (o.amountPaid || 0), 0);
        newTotalSpent = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        newTotalOrders = orders.length;
      }

      // STEP 4: Get last order date
      let newLastOrderDate = buyer.lastOrderDate;
      if (orders.length > 0) {
        const latestOrderDate = new Date(
          Math.max(...orders.map(o => new Date(o.createdAt || o.orderDate || 0)))
        );
        if (!isNaN(latestOrderDate.getTime())) {
          newLastOrderDate = latestOrderDate;
        }
      }

      // STEP 5: Compare with current buyer data
      const oldTotalDue = buyer.totalDue || 0;
      const oldTotalPaid = buyer.totalPaid || 0;
      const oldTotalSpent = buyer.totalSpent || 0;
      const oldTotalOrders = buyer.totalOrders || 0;
      const oldMonthlyBillsCount = buyer.monthlyBills?.length || 0;

      const hasDiscrepancy = 
        Math.abs(oldTotalDue - newTotalDue) > 0.01 ||
        Math.abs(oldTotalPaid - newTotalPaid) > 0.01 ||
        Math.abs(oldTotalSpent - newTotalSpent) > 0.01 ||
        oldTotalOrders !== newTotalOrders ||
        oldMonthlyBillsCount !== correctMonthlyBills.length;

      if (hasDiscrepancy) {
        updates.push({
          buyerId: buyerId,
          name: buyer.name,
          mobile: buyer.mobile,
          businessName: buyer.businessName,
          old: {
            totalDue: oldTotalDue,
            totalPaid: oldTotalPaid,
            totalSpent: oldTotalSpent,
            totalOrders: oldTotalOrders,
            monthlyBillsCount: oldMonthlyBillsCount
          },
          new: {
            totalDue: newTotalDue,
            totalPaid: newTotalPaid,
            totalSpent: newTotalSpent,
            totalOrders: newTotalOrders,
            monthlyBills: correctMonthlyBills,
            lastOrderDate: newLastOrderDate
          },
          source: bills.length > 0 ? 'bills' : 'orders',
          billCount: bills.length,
          orderCount: orders.length
        });
      }
    }

    if (updates.length === 0) {
      console.log('✅ All buyer data is already correct! No updates needed.\n');
      await mongoose.disconnect();
      rl.close();
      return;
    }

    // Display discrepancies
    console.log('⚠️  FOUND DISCREPANCIES:\n');
    console.log('='.repeat(120));
    
    updates.forEach((update, index) => {
      console.log(`\n${index + 1}. ${update.name} (${update.mobile})`);
      if (update.businessName) {
        console.log(`   Business: ${update.businessName}`);
      }
      console.log(`   Source: ${update.source.toUpperCase()} (${update.billCount} bills, ${update.orderCount} orders)`);
      console.log(`   
   Old Data:                    New Data:
   - Total Due:                 ₹${update.old.totalDue.toFixed(2).padEnd(18)} → ₹${update.new.totalDue.toFixed(2)}
   - Total Paid:                ₹${update.old.totalPaid.toFixed(2).padEnd(18)} → ₹${update.new.totalPaid.toFixed(2)}
   - Total Spent:               ₹${update.old.totalSpent.toFixed(2).padEnd(18)} → ₹${update.new.totalSpent.toFixed(2)}
   - Total Orders:              ${String(update.old.totalOrders).padEnd(21)} → ${update.new.totalOrders}
   - Monthly Bills Array:       ${String(update.old.monthlyBillsCount + ' bills').padEnd(21)} → ${update.new.monthlyBills.length} bills
      `);
      console.log('   ' + '-'.repeat(80));
    });

    console.log('\n' + '='.repeat(120));
    console.log(`\n📈 SUMMARY:`);
    console.log(`   Total buyers to update: ${updates.length}`);
    console.log(`   Total due correction: ₹${updates.reduce((sum, u) => sum + (u.new.totalDue - u.old.totalDue), 0).toFixed(2)}`);
    console.log(`   Total paid correction: ₹${updates.reduce((sum, u) => sum + (u.new.totalPaid - u.old.totalPaid), 0).toFixed(2)}`);
    console.log(`   Total spent correction: ₹${updates.reduce((sum, u) => sum + (u.new.totalSpent - u.old.totalSpent), 0).toFixed(2)}`);
    console.log('');

    // Ask for confirmation
    const confirmed = await askConfirmation('⚠️  Do you want to update these buyers with correct data? (yes/no): ');

    if (!confirmed) {
      console.log('\n❌ Update cancelled by user');
      await mongoose.disconnect();
      rl.close();
      return;
    }

    // Perform updates
    console.log('\n🔄 Updating buyer data...\n');
    
    let successCount = 0;
    let errorCount = 0;

    for (const update of updates) {
      try {
        await WholesaleBuyer.findByIdAndUpdate(
          update.buyerId,
          {
            $set: {
              totalDue: parseFloat(update.new.totalDue.toFixed(2)),
              totalPaid: parseFloat(update.new.totalPaid.toFixed(2)),
              totalSpent: parseFloat(update.new.totalSpent.toFixed(2)),
              totalOrders: update.new.totalOrders,
              monthlyBills: update.new.monthlyBills,
              lastOrderDate: update.new.lastOrderDate
            }
          }
        );
        
        console.log(`✅ Updated: ${update.name} (${update.mobile})`);
        successCount++;
        
      } catch (error) {
        console.log(`❌ Failed: ${update.name} - ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(120));
    console.log(`\n🎉 RECALCULATION COMPLETE!`);
    console.log(`   ✅ Successfully updated: ${successCount} buyers`);
    if (errorCount > 0) {
      console.log(`   ❌ Failed: ${errorCount} buyers`);
    }
    console.log('');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    rl.close();

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    await mongoose.disconnect();
    rl.close();
    process.exit(1);
  }
}

// Run the script
recalculateBuyerStats();
