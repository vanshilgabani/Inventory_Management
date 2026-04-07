// scripts/migrate-status-date.js
// Migrates ALL statusHistory entries from 07-Apr-2026 → 06-Apr-2026 (any status)

const mongoose = require('mongoose');
require('dotenv').config();
const MarketplaceSale = require('../server/src/models/MarketplaceSale');

// ─── Configuration ────────────────────────────────────────────────────────────
const DRY_RUN = false;  // ← Set true to preview without writing to DB

// Full UTC day range for 07-Apr-2026
const SOURCE_START = new Date('2026-04-07T00:00:00.000Z');
const SOURCE_END   = new Date('2026-04-07T23:59:59.999Z');

// Target: 06-Apr-2026 midnight UTC
const TARGET_DATE  = new Date('2026-04-06T00:00:00.000Z');
// ─────────────────────────────────────────────────────────────────────────────

const isSourceEntry = (entry) => {
  const d = new Date(entry.changedAt);
  return d >= SOURCE_START && d <= SOURCE_END;  // No status filter
};

const migrate = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // ── Step 1: Fetch all orders with ANY statusHistory entry on 07-Apr ───
    const orders = await MarketplaceSale.find({
      statusHistory: {
        $elemMatch: {
          changedAt: { $gte: SOURCE_START, $lte: SOURCE_END }
        }
      }
    }).lean();

    console.log(`📊 Found ${orders.length} order(s) with statusHistory on 07-Apr-2026`);

    if (orders.length === 0) {
      console.log('ℹ️  Nothing to migrate.');
      return;
    }

    // ── Step 2: DRY RUN preview ────────────────────────────────────────────
    if (DRY_RUN) {
      console.log('\n🔎 DRY RUN — No changes will be written.\n');
      orders.forEach((order) => {
        const hits = order.statusHistory.filter(isSourceEntry);
        console.log(`  📦 Order ${order._id} — ${hits.length} entry(s) would be updated`);
        hits.forEach((e) =>
          console.log(`     [${e.status}] changedAt: ${e.changedAt} → ${TARGET_DATE.toISOString()}`)
        );
      });
      return;
    }

    // ── Step 3: Build bulkWrite operations ────────────────────────────────
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

    // ── Step 4: Execute in bulk (single DB round-trip) ────────────────────
    const result = await MarketplaceSale.bulkWrite(bulkOps, { ordered: false });

    console.log('\n✅ Migration complete!');
    console.log(`   ✏️  Modified : ${result.modifiedCount} order(s)`);
    console.log(`   🔍 Matched  : ${result.matchedCount} order(s)`);

    // ── Step 5: Verification ──────────────────────────────────────────────
    const remaining = await MarketplaceSale.countDocuments({
      statusHistory: {
        $elemMatch: {
          changedAt: { $gte: SOURCE_START, $lte: SOURCE_END }
        }
      }
    });

    console.log(`\n🔍 Remaining Apr-07 entries: ${remaining}`);
    if (remaining === 0) {
      console.log('🎉 All entries successfully migrated to 06-Apr-2026!');
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