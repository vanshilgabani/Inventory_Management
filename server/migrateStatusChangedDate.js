// scripts/migrate-status-date.js
// Migrates ALL statusHistory entries from 25-Apr-2026 → 24-Apr-2026 IST (any status)

const mongoose = require('mongoose');
const readline = require('readline');
require('dotenv').config();
const MarketplaceSale = require('../server/src/models/MarketplaceSale');

// ─── Configuration ────────────────────────────────────────────────────────────
const SOURCE_START = new Date('2026-05-08T18:30:00.000Z');  // Apr 25 00:00 IST
const SOURCE_END   = new Date('2026-05-09T18:29:59.999Z');  // Apr 25 23:59 IST
const TARGET_DATE  = new Date('2026-05-08T18:30:00.000Z');  // Apr 24 00:00 IST
// ─────────────────────────────────────────────────────────────────────────────

const isSourceEntry = (entry) => {
  const d = new Date(entry.changedAt);
  return d >= SOURCE_START && d <= SOURCE_END;
};

// ─── Interactive confirmation prompt ─────────────────────────────────────────
const confirm = (question) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
};
// ─────────────────────────────────────────────────────────────────────────────

const migrate = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // ── Step 1: Fetch ALL orders with ANY statusHistory entry on 25-Apr IST ──
    const orders = await MarketplaceSale.find({
      statusHistory: {
        $elemMatch: {
          changedAt: { $gte: SOURCE_START, $lte: SOURCE_END }
        }
      }
    }).lean();

    console.log(`📊 Found ${orders.length} order(s) with statusHistory entries on 25-Apr-2026 IST`);

    if (orders.length === 0) {
      console.log('ℹ️  Nothing to migrate.');
      return;
    }

    // ── Step 2: Preview with Order Item IDs ───────────────────────────────
    console.log('\n🔎 PREVIEW — Changes that will be applied:\n');
    let totalEntries = 0;
    const affectedOrders = [];

    orders.forEach((order) => {
      const hits = order.statusHistory.filter(isSourceEntry);
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

    console.log(`📝 Summary: ${orders.length} order(s) | ${totalEntries} statusHistory entry(s) will be updated`);
    console.log(`   FROM : 25-Apr-2026 IST`);
    console.log(`   TO   : 24-Apr-2026 IST\n`);

    // ── Step 3: Ask for confirmation ──────────────────────────────────────
    const answer = await confirm('⚠️  Proceed with migration? Type "yes" to confirm: ');

    if (answer !== 'yes') {
      console.log('\n🚫 Migration cancelled. No changes were made.');
      return;
    }

    // ── Step 4: Build bulkWrite operations ────────────────────────────────
    const bulkOps = orders.map((order) => ({
      updateOne: {
        filter: { _id: order._id },
        update: {
          $set: {
            statusHistory: order.statusHistory.map((entry) =>
              isSourceEntry(entry) ? { ...entry, changedAt: TARGET_DATE } : entry
            )
          }
        }
      }
    }));

    // ── Step 5: Execute in bulk (single DB round-trip) ────────────────────
    const result = await MarketplaceSale.bulkWrite(bulkOps, { ordered: false });

    console.log('\n✅ Migration complete!');
    console.log(`   ✏️  Modified : ${result.modifiedCount} order(s)`);
    console.log(`   🔍 Matched  : ${result.matchedCount} order(s)`);

    // ── Step 6: Rollback Reference Log ────────────────────────────────────
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

    // ── Step 7: Verification ──────────────────────────────────────────────
    const remaining = await MarketplaceSale.countDocuments({
      statusHistory: {
        $elemMatch: {
          changedAt: { $gte: SOURCE_START, $lte: SOURCE_END }
        }
      }
    });

    console.log(`🔍 Remaining Apr-25 IST entries: ${remaining}`);
    if (remaining === 0) {
      console.log('🎉 All entries successfully migrated to 24-Apr-2026 IST!');
    } else {
      console.warn(`⚠️  ${remaining} entry(s) were NOT migrated. Investigate manually.`);
    }

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

migrate();