// fixAllOldChallanPayments.js
require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.DATABASE_URL;

if (!MONGO_URI) {
  console.error('❌ Error: MongoDB URI not found in .env file');
  process.exit(1);
}

const MonthlyBill = require('../server/src/models/MonthlyBill');
const WholesaleOrder = require('../server/src/models/WholesaleOrder');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askConfirmation = (question) =>
  new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim().toLowerCase() === 'yes');
    });
  });

const round2 = (num) => Math.round((Number(num) || 0) * 100) / 100;
const round6 = (num) => Math.round((Number(num) || 0) * 1000000) / 1000000;

async function buildGroupPreview({ organizationId, buyerId, month, year }) {
  // Fetch ALL bills for this buyer+period (handles split bills)
  const bills = await MonthlyBill.find({
    organizationId,
    'buyer.id': buyerId,
    'billingPeriod.month': month,
    'billingPeriod.year': year,
  }).lean();

  const challanPaymentMap = new Map();

  for (const bill of bills) {
    const challans = Array.isArray(bill.challans) ? bill.challans : [];
    const realChallans = challans.filter((c) => c && c.challanId);

    const realChallansTotal = round2(
      realChallans.reduce((sum, c) => sum + Number(c.totalAmount || 0), 0)
    );

    const amountPaid = round2(bill?.financials?.amountPaid || 0);
    const paidForRealChallans = Math.min(amountPaid, realChallansTotal);
    const billPaidRatio =
      realChallansTotal > 0 ? paidForRealChallans / realChallansTotal : 0;

    for (const challan of realChallans) {
      const challanId = String(challan.challanId);

      if (!challanPaymentMap.has(challanId)) {
        challanPaymentMap.set(challanId, {
          challanId,
          challanNumber: challan.challanNumber,
          totalInBills: 0,
          totalPaid: 0,
          appearances: [],
        });
      }

      const entry = challanPaymentMap.get(challanId);
      const challanAmount = Number(challan.totalAmount || 0);
      const allocatedPaid = challanAmount * billPaidRatio;

      entry.totalInBills += challanAmount;
      entry.totalPaid += allocatedPaid;
      entry.appearances.push({
        billNumber: bill.billNumber,
        billStatus: bill.status,
        challanAmount: round2(challanAmount),
        paidAmount: round2(allocatedPaid),
        paidRatio: round6(billPaidRatio),
      });
    }
  }

  const aggregateBalanceDue = round2(
    bills.reduce((sum, b) => sum + Number(b?.financials?.balanceDue || 0), 0)
  );
  const aggregateFullyPaid = aggregateBalanceDue === 0;

  const orderRows = [];
  let changed = 0;
  let unchanged = 0;
  let missingOrders = 0;
  let roundingAdjusted = 0;

  for (const [challanId, info] of challanPaymentMap.entries()) {
    const order = await WholesaleOrder.findOne({
      _id: challanId,
      deletedAt: null,
    }).lean();

    if (!order) {
      missingOrders++;
      orderRows.push({
        challanId,
        challanNumber: info.challanNumber,
        found: false,
      });
      continue;
    }

    let calculatedPaid = Math.min(
      round2(info.totalPaid),
      round2(order.totalAmount || 0)
    );
    let calculatedDue = Math.max(
      0,
      round2(Number(order.totalAmount || 0) - calculatedPaid)
    );

    let calculatedStatus = 'Pending';
    if (calculatedDue <= 0) {
      calculatedStatus = 'Paid';
    } else if (calculatedPaid > 0) {
      calculatedStatus = 'Partial';
    }

    let residualRoundedOff = 0;
    if (aggregateFullyPaid && calculatedDue > 0 && calculatedDue < 1) {
      residualRoundedOff = calculatedDue;
      calculatedPaid = round2(order.totalAmount || 0);
      calculatedDue = 0;
      calculatedStatus = 'Paid';
      roundingAdjusted++;
    }

    const currentPaid   = round2(order.amountPaid || 0);
    const currentDue    = round2(order.amountDue || 0);
    const currentStatus = order.paymentStatus || 'Pending';

    const needsUpdate =
      Math.abs(currentPaid - calculatedPaid) > 0.01 ||
      Math.abs(currentDue  - calculatedDue)  > 0.01 ||
      currentStatus !== calculatedStatus;

    if (needsUpdate) changed++;
    else unchanged++;

    orderRows.push({
      challanId: String(order._id),
      challanNumber: order.challanNumber,
      found: true,
      totalAmount: round2(order.totalAmount || 0),
      current: {
        amountPaid: currentPaid,
        amountDue:  currentDue,
        paymentStatus: currentStatus,
      },
      calculated: {
        amountPaid: calculatedPaid,
        amountDue:  calculatedDue,
        paymentStatus: calculatedStatus,
      },
      residualRoundedOff: round2(residualRoundedOff),
      needsUpdate,
      appearances: info.appearances,
    });
  }

  return {
    key: {
      organizationId: String(organizationId),
      buyerId: String(buyerId),
      month,
      year,
    },
    billsCount: bills.length,
    challansProcessed: challanPaymentMap.size,
    changed,
    unchanged,
    missingOrders,
    roundingAdjusted,
    aggregateBalanceDue,
    aggregateFullyPaid,
    orderRows,
  };
}

async function fixAllOldChallanPayments() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Discover all unique (orgId, buyerId, month, year) groups from bills
    const groups = await MonthlyBill.aggregate([
      {
        $group: {
          _id: {
            organizationId:  '$organizationId',
            buyerId:          '$buyer.id',
            month:            '$billingPeriod.month',
            year:             '$billingPeriod.year',
            buyerName:        '$buyer.name',
            buyerMobile:      '$buyer.mobile',
            buyerBusiness:    '$buyer.businessName',
          },
          billsCount: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    if (groups.length === 0) {
      console.log('ℹ️  No bill groups found in database');
      await mongoose.disconnect();
      rl.close();
      return;
    }

    console.log(`📊 Found ${groups.length} unique buyer-period bill groups\n`);
    console.log('🔍 Analysing challan payment state (excluding PREV-ADJ rows)...\n');

    const updates = [];

    for (const group of groups) {
      const preview = await buildGroupPreview({
        organizationId: group._id.organizationId,
        buyerId:        group._id.buyerId,
        month:          group._id.month,
        year:           group._id.year,
      });

      if (preview.changed > 0 || preview.missingOrders > 0) {
        updates.push({
          buyerName:    group._id.buyerName    || '—',
          buyerMobile:  group._id.buyerMobile  || '—',
          buyerBusiness: group._id.buyerBusiness || '',
          preview,
        });
      }
    }

    if (updates.length === 0) {
      console.log('✅ All challan payment data is already correct. No updates needed.\n');
      await mongoose.disconnect();
      rl.close();
      return;
    }

    console.log('⚠️  FOUND DISCREPANCIES:\n');
    console.log('='.repeat(130));

    let globalTotalChallans   = 0;
    let globalChanged         = 0;
    let globalUnchanged       = 0;
    let globalMissing         = 0;
    let globalRounding        = 0;
    let globalAmountPaidDiff  = 0;
    let globalAmountDueDiff   = 0;

    updates.forEach((update, index) => {
      const p = update.preview;

      console.log(`\n${index + 1}. ${update.buyerName} (${update.buyerMobile}) — ${p.key.month} ${p.key.year}`);
      if (update.buyerBusiness) console.log(`   Business: ${update.buyerBusiness}`);
      console.log(`   Bills in period:      ${p.billsCount} ${p.billsCount > 1 ? '(split bill)' : ''}`);
      console.log(`   Challans processed:   ${p.challansProcessed}`);
      console.log(`   Period fully paid:    ${p.aggregateFullyPaid ? 'Yes ✅' : 'No'} (balanceDue=₹${p.aggregateBalanceDue.toFixed(2)})`);

      if (p.missingOrders > 0) {
        console.log(`   ⚠️  Missing/deleted orders: ${p.missingOrders}`);
      }
      if (p.roundingAdjusted > 0) {
        console.log(`   🔧 Rounding residuals to clear: ${p.roundingAdjusted}`);
      }

      console.log(`\n   Challan-level changes (${p.changed} of ${p.challansProcessed} need update):\n`);
      console.log(
        `   ${'Challan No.'.padEnd(25)} ${'Total Amt'.padEnd(14)} ${'Old Paid'.padEnd(14)} ${'New Paid'.padEnd(14)} ${'Old Status'.padEnd(12)} ${'New Status'.padEnd(12)} Changed?`
      );
      console.log('   ' + '-'.repeat(105));

      p.orderRows.forEach((row) => {
        if (!row.found) {
          console.log(`   ${(row.challanNumber || row.challanId).toString().padEnd(25)} ⚠️  Order not found (soft-deleted?)`);
          return;
        }
        const paidDiff = round2(row.calculated.amountPaid - row.current.amountPaid);
        const dueDiff  = round2(row.calculated.amountDue  - row.current.amountDue);

        globalAmountPaidDiff += paidDiff;
        globalAmountDueDiff  += dueDiff;

        console.log(
          `   ${row.challanNumber.toString().padEnd(25)}` +
          ` ₹${row.totalAmount.toFixed(2).padEnd(12)}` +
          ` ₹${row.current.amountPaid.toFixed(2).padEnd(12)}` +
          ` ₹${row.calculated.amountPaid.toFixed(2).padEnd(12)}` +
          ` ${row.current.paymentStatus.padEnd(12)}` +
          ` ${row.calculated.paymentStatus.padEnd(12)}` +
          ` ${row.needsUpdate ? '✏️  YES' : '—'}`
        );
        if (row.residualRoundedOff > 0) {
          console.log(`   ${''.padEnd(25)} 🔧 Rounding ₹${row.residualRoundedOff.toFixed(2)} written off`);
        }
      });

      console.log('   ' + '-'.repeat(105));
      globalTotalChallans += p.challansProcessed;
      globalChanged       += p.changed;
      globalUnchanged     += p.unchanged;
      globalMissing       += p.missingOrders;
      globalRounding      += p.roundingAdjusted;
    });

    console.log('\n' + '='.repeat(130));
    console.log('\n📈 SUMMARY:');
    console.log(`   Bill groups analysed:    ${groups.length}`);
    console.log(`   Groups with changes:     ${updates.length}`);
    console.log(`   Total challans scanned:  ${globalTotalChallans}`);
    console.log(`   Challans to update:      ${globalChanged}`);
    console.log(`   Already correct:         ${globalUnchanged}`);
    console.log(`   Missing orders:          ${globalMissing}`);
    console.log(`   Rounding to clear:       ${globalRounding}`);
    console.log(`   Net amountPaid shift:    ₹${round2(globalAmountPaidDiff).toFixed(2)}`);
    console.log(`   Net amountDue  shift:    ₹${round2(globalAmountDueDiff).toFixed(2)}`);
    console.log('');
    console.log('ℹ️  NOTE: Only amountPaid, amountDue, and paymentStatus will be updated');
    console.log('         on WholesaleOrder. Bills and buyer totals are NOT touched.');
    console.log('         No paymentHistory entries will be added (clean backfill).');
    console.log('');

    const confirmed = await askConfirmation(
      '⚠️  Do you want to apply these fixes to all challan records? Type "yes" to continue: '
    );

    if (!confirmed) {
      console.log('\n❌ Update cancelled by user');
      await mongoose.disconnect();
      rl.close();
      return;
    }

    console.log('\n🔄 Applying fixes...\n');

    let successCount = 0;
    let errorCount   = 0;

    for (const update of updates) {
      const p = update.preview;

      for (const row of p.orderRows) {
        if (!row.found || !row.needsUpdate) continue;

        try {
          await WholesaleOrder.updateOne(
            { _id: row.challanId, deletedAt: null },
            {
              $set: {
                amountPaid:    row.calculated.amountPaid,
                amountDue:     row.calculated.amountDue,
                paymentStatus: row.calculated.paymentStatus,
              },
            }
          );
          console.log(
            `   ✅ ${row.challanNumber} → paid=₹${row.calculated.amountPaid.toFixed(2)} due=₹${row.calculated.amountDue.toFixed(2)} status=${row.calculated.paymentStatus}`
          );
          successCount++;
        } catch (err) {
          console.log(`   ❌ ${row.challanNumber} — ${err.message}`);
          errorCount++;
        }
      }
    }

    console.log('\n' + '='.repeat(130));
    console.log('\n🎉 CHALLAN PAYMENT FIX COMPLETE!');
    console.log(`   ✅ Successfully updated: ${successCount} challans`);
    if (errorCount > 0) {
      console.log(`   ❌ Failed:              ${errorCount} challans`);
    }
    console.log('');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    rl.close();
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    try { await mongoose.disconnect(); } catch (_) {}
    rl.close();
    process.exit(1);
  }
}

fixAllOldChallanPayments();
