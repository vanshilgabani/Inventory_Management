// fix-challan-allocation.js
// Run: node fix-challan-allocation.js

require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'your_mongodb_uri_here';

// ─── MINIMAL SCHEMAS (read-only safe) ────────────────────────────────────────
const WholesaleOrderSchema = new mongoose.Schema({}, { strict: false });
const MonthlyBillSchema    = new mongoose.Schema({}, { strict: false });

const WholesaleOrder = mongoose.model('WholesaleOrder', WholesaleOrderSchema);
const MonthlyBill    = mongoose.model('MonthlyBill',    MonthlyBillSchema);

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim().toLowerCase()); }));
}

// ─── CORE: Calculate correct allocations ─────────────────────────────────────
async function computeCorrections() {
  // Find all bills that have PREV-ADJ challan AND have been paid something
  const bills = await MonthlyBill.find({
    'challans.challanNumber': 'PREV-ADJ',
    'financials.amountPaid':  { $gt: 0 }
  }).lean();

  if (bills.length === 0) {
    console.log('\n✅ No bills with PREV-ADJ + payments found. Nothing to fix.\n');
    return [];
  }

  console.log(`\n📋 Found ${bills.length} bill(s) with PREV-ADJ challan and existing payments.\n`);

  const allCorrections = [];

  for (const bill of bills) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`  Bill     : ${bill.billNumber}`);
    console.log(`  Buyer    : ${bill.buyer?.name} (${bill.buyer?.mobile})`);
    console.log(`  Period   : ${bill.billingPeriod?.month} ${bill.billingPeriod?.year}`);
    console.log(`  GrandTotal: ${inr(bill.financials?.grandTotal)}`);
    console.log(`  AmountPaid: ${inr(bill.financials?.amountPaid)}`);
    console.log(`  BalanceDue: ${inr(bill.financials?.balanceDue)}`);
    console.log(`${'─'.repeat(70)}`);

    // Real challans only (exclude PREV-ADJ)
    const realChallans = bill.challans.filter(c => c.challanId);
    const realChallansTotal = realChallans.reduce((s, c) => s + (c.totalAmount || 0), 0);
    const amountPaid        = bill.financials?.amountPaid || 0;
    const paymentForReal    = Math.min(amountPaid, realChallansTotal);
    const correctRatio      = realChallansTotal > 0 ? paymentForReal / realChallansTotal : 0;

    // OLD (wrong) ratio
    const grandTotal        = bill.financials?.grandTotal || 0;
    const wrongRatio        = grandTotal > 0 ? amountPaid / grandTotal : 0;

    console.log(`  Real Challans Total : ${inr(realChallansTotal)}`);
    console.log(`  PREV-ADJ Amount     : ${inr(grandTotal - realChallansTotal)}`);
    console.log(`  ❌ Old (wrong) ratio : ${(wrongRatio * 100).toFixed(4)}%`);
    console.log(`  ✅ New (correct) ratio: ${(correctRatio * 100).toFixed(4)}%`);
    console.log('');

    const billCorrections = [];

    for (const challan of realChallans) {
      const challanId = challan.challanId?.toString();
      if (!challanId) continue;

      const order = await WholesaleOrder.findById(challanId).lean();
      if (!order) {
        console.log(`  ⚠️  Order not found for challan ${challan.challanNumber} — skipping`);
        continue;
      }

      const correctPaid = Math.min(
        Math.round((challan.totalAmount || 0) * correctRatio * 100) / 100,
        order.totalAmount || 0
      );
      const correctDue  = Math.max(0, (order.totalAmount || 0) - correctPaid);
      const currentPaid = order.amountPaid || 0;
      const currentDue  = order.amountDue  || 0;
      const diff        = correctPaid - currentPaid;

      const hasChange   = Math.abs(diff) > 0.01;

      console.log(`  Challan  : ${challan.challanNumber}  |  Order Total: ${inr(order.totalAmount)}`);
      console.log(`  Current  : Paid ${inr(currentPaid)}  |  Due ${inr(currentDue)}`);
      console.log(`  Corrected: Paid ${inr(correctPaid)}  |  Due ${inr(correctDue)}  ${hasChange ? `← change: ${diff > 0 ? '+' : ''}${inr(diff)}` : '← no change'}`);
      console.log('');

      if (hasChange) {
        billCorrections.push({
          orderId       : challanId,
          challanNumber : challan.challanNumber,
          oldPaid       : currentPaid,
          oldDue        : currentDue,
          newPaid       : correctPaid,
          newDue        : correctDue,
          totalAmount   : order.totalAmount,
          diff
        });
      }
    }

    if (billCorrections.length > 0) {
      allCorrections.push({ bill, corrections: billCorrections });
    } else {
      console.log(`  ✅ All challans for this bill are already correct.\n`);
    }
  }

  return allCorrections;
}

// ─── APPLY CORRECTIONS ───────────────────────────────────────────────────────
async function applyCorrections(allCorrections) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    let totalFixed = 0;

    for (const { corrections } of allCorrections) {
      for (const c of corrections) {
        const newStatus =
          c.newDue === 0 ? 'Paid' :
          c.newPaid > 0  ? 'Partial' : 'Pending';

        await WholesaleOrder.findByIdAndUpdate(
          c.orderId,
          {
            $set: {
              amountPaid    : c.newPaid,
              amountDue     : c.newDue,
              paymentStatus : newStatus
            },
            $push: {
              paymentHistory: {
                amount       : c.newPaid - c.oldPaid,
                paymentDate  : new Date(),
                paymentMethod: 'Correction',
                notes        : `Data correction: adjusted from ${inr(c.oldPaid)} to ${inr(c.newPaid)} (PREV-ADJ ratio fix)`,
                recordedBy   : 'System-Fix-Script'
              }
            }
          },
          { session }
        );

        console.log(`  ✅ Fixed: ${c.challanNumber} → Paid: ${inr(c.newPaid)} | Due: ${inr(c.newDue)} | Status: ${newStatus}`);
        totalFixed++;
      }
    }

    await session.commitTransaction();
    console.log(`\n🎉 Done! ${totalFixed} order(s) corrected successfully.\n`);
  } catch (err) {
    await session.abortTransaction();
    console.error('\n❌ Error applying corrections:', err.message);
    console.error('   Transaction rolled back. No data was changed.\n');
  } finally {
    session.endSession();
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔧 Challan Allocation Correction Script');
  console.log('   Fixes orders under-allocated due to PREV-ADJ ratio bug\n');

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  const allCorrections = await computeCorrections();

  if (allCorrections.length === 0) {
    await mongoose.disconnect();
    return;
  }

  const totalOrders = allCorrections.reduce((s, b) => s + b.corrections.length, 0);
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  📌 Summary: ${totalOrders} order(s) across ${allCorrections.length} bill(s) need correction`);
  console.log(`${'═'.repeat(70)}\n`);

  const answer = await ask('  ❓ Do you want to apply these corrections? (yes / no): ');

  if (answer === 'yes' || answer === 'y') {
    console.log('\n  Applying corrections...\n');
    await applyCorrections(allCorrections);
  } else {
    console.log('\n  ⏸️  Aborted. No changes were made.\n');
  }

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});