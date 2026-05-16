// scripts/migrate-status-date.js
// Migrates statusHistory entries from 25-Apr-2026 → 24-Apr-2026 IST
// Supports filtering by status: rto, returned, wrong_return, or all

const mongoose = require('mongoose');
const readline = require('readline');
require('dotenv').config();
const MarketplaceSale = require('../server/src/models/MarketplaceSale');

// ─── Configuration ────────────────────────────────────────────────────────────
const SOURCE_START = new Date('2026-05-15T18:30:00.000Z');  // Apr 25 00:00 IST
const SOURCE_END   = new Date('2026-05-16T18:29:59.999Z');  // Apr 25 23:59 IST
const TARGET_DATE  = new Date('2026-05-15T18:30:00.000Z');  // Apr 24 00:00 IST
// ─────────────────────────────────────────────────────────────────────────────

// ─── Status Options ───────────────────────────────────────────────────────────
const STATUS_OPTIONS = {
  '1': { label: 'RTO',          values: ['rto', 'RTO'] },
  '2': { label: 'Returned',     values: ['returned', 'RETURNED'] },
  '3': { label: 'Wrong Return', values: ['wrong_return', 'WRONG_RETURN', 'wrong return', 'Wrong Return'] },
  '4': { label: 'All Statuses', values: null }   // null = match all
};
// ─────────────────────────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const ask = (question) =>
  new Promise((resolve) => rl.question(question, (ans) => resolve(ans.trim())));

// ─── Check if a statusHistory entry falls in source date range ────────────────
const isSourceEntry = (entry) => {
  const d = new Date(entry.changedAt);
  return d >= SOURCE_START && d <= SOURCE_END;
};

// ─── Check if a statusHistory entry matches the chosen status filter ──────────
const matchesStatus = (entry, statusValues) => {
  if (statusValues === null) return true;           // "All" option
  const entryStatus = (entry.status || entry.newStatus || '').toLowerCase().trim();
  return statusValues.some((v) => v.toLowerCase() === entryStatus);
};

// ─── Select status interactively ─────────────────────────────────────────────
const selectStatus = async () => {
  console.log('\n📋 Select the status to migrate:\n');
  Object.entries(STATUS_OPTIONS).forEach(([key, opt]) => {
    console.log(`   [${key}] ${opt.label}`);
  });
  console.log('');

  while (true) {
    const choice = await ask('👉 Enter your choice (1-4): ');
    if (STATUS_OPTIONS[choice]) {
      console.log(`\n✅ Selected: "${STATUS_OPTIONS[choice].label}"\n`);
      return STATUS_OPTIONS[choice];
    }
    console.log('⚠️  Invalid choice. Please enter 1, 2, 3, or 4.');
  }
};
// ─────────────────────────────────────────────────────────────────────────────

const migrate = async () => {
  try {
    // ── Step 0: Choose status filter ─────────────────────────────────────────
    const selectedStatus = await selectStatus();

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // ── Step 1: Fetch orders with statusHistory entries in source date range ──
    const orders = await MarketplaceSale.find({
      statusHistory: {
        $elemMatch: {
          changedAt: { $gte: SOURCE_START, $lte: SOURCE_END }
        }
      }
    }).lean();

    console.log(`📊 Found ${orders.length} order(s) with statusHistory entries on 25-Apr-2026 IST`);

    // ── Step 2: Filter entries by chosen status ───────────────────────────────
    const matchingOrders = orders
      .map((order) => ({
        ...order,
        _matchingEntries: order.statusHistory.filter(
          (e) => isSourceEntry(e) && matchesStatus(e, selectedStatus.values)
        )
      }))
      .filter((order) => order._matchingEntries.length > 0);

    console.log(
      `🔎 After filtering by status "${selectedStatus.label}": ${matchingOrders.length} order(s) affected`
    );

    if (matchingOrders.length === 0) {
      console.log('ℹ️  Nothing to migrate for the selected status.');
      rl.close();
      return;
    }

    // ── Step 3: Preview ───────────────────────────────────────────────────────
    console.log('\n🔎 PREVIEW — Changes that will be applied:\n');
    let totalEntries = 0;
    const affectedOrders = [];

    matchingOrders.forEach((order) => {
      const hits = order._matchingEntries;
      totalEntries += hits.length;

      affectedOrders.push({
        _id: order._id,
        marketplaceOrderId: order.marketplaceOrderId,
        orderItemId: order.orderItemId,
        entries: hits.map((e) => ({
          status: e.status || e.newStatus,
          originalChangedAt: new Date(e.changedAt).toISOString(),
          willBecome: TARGET_DATE.toISOString()
        }))
      });

      console.log(`  📦 _id            : ${order._id}`);
      console.log(`     Marketplace ID : ${order.marketplaceOrderId}`);
      console.log(`     Order Item ID  : ${order.orderItemId}`);
      console.log(`     Entries (${hits.length}):`);
      hits.forEach((e) =>
        console.log(
          `       [${e.status || e.newStatus}] ${new Date(e.changedAt).toISOString()} → ${TARGET_DATE.toISOString()}`
        )
      );
      console.log('');
    });

    console.log(`📝 Summary: ${matchingOrders.length} order(s) | ${totalEntries} statusHistory entry(s) will be updated`);
    console.log(`   Status : ${selectedStatus.label}`);
    console.log(`   FROM   : 25-Apr-2026 IST`);
    console.log(`   TO     : 24-Apr-2026 IST\n`);

    // ── Step 4: Confirm ───────────────────────────────────────────────────────
    const answer = await ask('⚠️  Proceed with migration? Type "yes" to confirm: ');

    if (answer.toLowerCase() !== 'yes') {
      console.log('\n🚫 Migration cancelled. No changes were made.');
      rl.close();
      return;
    }

    // ── Step 5: Build bulkWrite operations ────────────────────────────────────
    const bulkOps = matchingOrders.map((order) => ({
      updateOne: {
        filter: { _id: order._id },
        update: {
          $set: {
            statusHistory: order.statusHistory.map((entry) =>
              isSourceEntry(entry) && matchesStatus(entry, selectedStatus.values)
                ? { ...entry, changedAt: TARGET_DATE }
                : entry
            )
          }
        }
      }
    }));

    // ── Step 6: Execute bulkWrite ─────────────────────────────────────────────
    const result = await MarketplaceSale.bulkWrite(bulkOps, { ordered: false });

    console.log('\n✅ Migration complete!');
    console.log(`   ✏️  Modified : ${result.modifiedCount} order(s)`);
    console.log(`   🔍 Matched  : ${result.matchedCount} order(s)`);

    // ── Step 7: Rollback Reference Log ────────────────────────────────────────
    console.log('\n📋 ROLLBACK REFERENCE — Save this if you need to undo:\n');
    affectedOrders.forEach((o) => {
      console.log(`  _id            : ${o._id}`);
      console.log(`  Marketplace ID : ${o.marketplaceOrderId}`);
      console.log(`  Order Item ID  : ${o.orderItemId}`);
      o.entries.forEach((e) =>
        console.log(`  [${e.status}] Restore changedAt to: ${e.originalChangedAt}`)
      );
      console.log('');
    });

    // ── Step 8: Verification ──────────────────────────────────────────────────
    const verifyElemMatch = { changedAt: { $gte: SOURCE_START, $lte: SOURCE_END } };
    if (selectedStatus.values !== null) {
      verifyElemMatch.$or = selectedStatus.values.map((v) => ({
        $or: [{ status: v }, { newStatus: v }]
      }));
    }

    const remaining = await MarketplaceSale.countDocuments({
      statusHistory: { $elemMatch: verifyElemMatch }
    });

    console.log(`🔍 Remaining Apr-25 IST entries for "${selectedStatus.label}": ${remaining}`);
    if (remaining === 0) {
      console.log(`🎉 All "${selectedStatus.label}" entries successfully migrated to 24-Apr-2026 IST!`);
    } else {
      console.warn(`⚠️  ${remaining} entry(s) were NOT migrated. Investigate manually.`);
    }

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    rl.close();
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

migrate();