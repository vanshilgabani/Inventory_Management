// fixOldBills.js
// Run this script ONCE to fix existing bills where adjustment challans were used

const mongoose = require('mongoose');
const MonthlyBill = require('../server/src/models/MonthlyBill'); // Adjust path as needed
const WholesaleBuyer = require('../server/src/models/WholesaleBuyer'); // Adjust path as needed

// ⚠️ REPLACE WITH YOUR MONGODB CONNECTION STRING
const MONGODB_URI = 'mongodb+srv://vanshilgabani:dharmajivanv1@inventorymanagement.4bk0m5j.mongodb.net/InventoryManagement?retryWrites=true&w=majority';

async function fixOldBills() {
  try {
    // Connect to database
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to database');

    // STEP 1: Find all bills with adjustment challans
    const billsWithAdjustments = await MonthlyBill.find({
      'challans.challanNumber': 'PREV-ADJ'
    });

    console.log(`\n📋 Found ${billsWithAdjustments.length} bills with adjustment challans`);

    if (billsWithAdjustments.length === 0) {
      console.log('✅ No bills to fix!');
      await mongoose.disconnect();
      return;
    }

    let fixedBillsCount = 0;
    let fixedOldBillsCount = 0;
    const updatedBuyers = new Set();

    // STEP 2: Process each bill
    for (const bill of billsWithAdjustments) {
      console.log(`\n🔍 Processing Bill: ${bill.billNumber}`);
      console.log(`   Buyer: ${bill.buyer.name}`);
      console.log(`   Period: ${bill.billingPeriod.month} ${bill.billingPeriod.year}`);

      // STEP 3: Find old unpaid bills for this buyer
      const oldBills = await MonthlyBill.find({
        organizationId: bill.organizationId,
        'buyer.id': bill.buyer.id,
        status: { $in: ['generated', 'sent', 'partial', 'overdue'] },
        'billingPeriod.endDate': { $lt: bill.billingPeriod.startDate }
      });

      if (oldBills.length === 0) {
        console.log('   ℹ️  No old unpaid bills found');
        continue;
      }

      console.log(`   📌 Found ${oldBills.length} old unpaid bill(s) to fix`);

      // STEP 4: Mark old bills as paid
      for (const oldBill of oldBills) {
        const oldOutstanding = oldBill.financials.balanceDue;

        console.log(`      - Fixing ${oldBill.billNumber} (Outstanding: ₹${oldOutstanding})`);

        oldBill.financials.balanceDue = 0;
        oldBill.financials.amountPaid = oldBill.financials.grandTotal;
        oldBill.status = 'paid';
        oldBill.paidAt = new Date();

        // Add payment history
        oldBill.paymentHistory.push({
          amount: oldOutstanding,
          paymentDate: new Date(),
          paymentMethod: 'Other',
          notes: `[AUTO-FIX] Outstanding ₹${oldOutstanding} was included as products in bill ${bill.billNumber}`,
          recordedBy: 'System',
          recordedByRole: 'system'
        });

        await oldBill.save();
        fixedOldBillsCount++;
      }

      fixedBillsCount++;
      updatedBuyers.add(bill.buyer.id);
    }

    // STEP 5: Recalculate buyer totals
    console.log(`\n🔄 Recalculating totals for ${updatedBuyers.size} buyer(s)...`);

    for (const buyerId of updatedBuyers) {
      const buyer = await WholesaleBuyer.findById(buyerId);
      if (!buyer) continue;

      // Recalculate from bills
      if (buyer.monthlyBills && buyer.monthlyBills.length > 0) {
        buyer.totalDue = buyer.monthlyBills.reduce((sum, b) => sum + (b.balanceDue || 0), 0);
        buyer.totalPaid = buyer.monthlyBills.reduce((sum, b) => sum + (b.amountPaid || 0), 0);
        
        await buyer.save();
        console.log(`   ✅ Updated buyer: ${buyer.name} (Total Due: ₹${buyer.totalDue})`);
      }
    }

    // STEP 6: Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ FIX COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log(`📊 Bills processed: ${fixedBillsCount}`);
    console.log(`📝 Old bills marked as paid: ${fixedOldBillsCount}`);
    console.log(`👥 Buyers updated: ${updatedBuyers.size}`);
    console.log('='.repeat(60));

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from database');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
console.log('🚀 Starting fix for old bills...\n');
fixOldBills();
