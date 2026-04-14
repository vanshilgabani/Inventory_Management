/**
 * Fix Duplicate Receivings caused by double-sync bug
 *
 * Phase 1 — audit:   DRY_RUN=true  node scripts/fixDuplicateReceivings.js
 * Phase 2 — fix:     DRY_RUN=false node scripts/fixDuplicateReceivings.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// ─── CONFIG ────────────────────────────────────────────────
const DRY_RUN = process.env.DRY_RUN !== 'false'; // default: true (safe)
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
// ───────────────────────────────────────────────────────────

if (!MONGO_URI) {
  console.error('❌  MONGO_URI not set in environment');
  process.exit(1);
}

// ── Receiving model (minimal — only fields we need) ─────────
// Adjust collection name if yours is different (e.g. 'purchaseReceivings')
const ReceivingSchema = new mongoose.Schema({}, { strict: false, collection: 'receivings' });
const Receiving = mongoose.model('Receiving', ReceivingSchema);

// ── Product model (for reversing stock if needed) ───────────
const ProductSchema = new mongoose.Schema({}, { strict: false, collection: 'products' });
const Product = mongoose.model('Product', ProductSchema);

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log(`✅  Connected to MongoDB`);
  console.log(`🔍  Mode: ${DRY_RUN ? '⚠️  DRY RUN (no changes will be made)' : '🔥  LIVE — changes WILL be written'}\n`);

  // ── STEP 1: Find all sourceOrderIds that appear more than once ──
  const duplicates = await Receiving.aggregate([
    {
      $match: {
        sourceOrderId: { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: '$sourceOrderId',
        count: { $sum: 1 },
        ids: { $push: '$_id' },
        createdAts: { $push: '$createdAt' },
        docs: { $push: '$$ROOT' },
      },
    },
    {
      $match: { count: { $gt: 1 } },
    },
    {
      $sort: { count: -1 },
    },
  ]);

  if (duplicates.length === 0) {
    console.log('✅  No duplicate receivings found. Nothing to fix.');
    await mongoose.disconnect();
    return;
  }

  console.log(`⚠️  Found ${duplicates.length} sourceOrderId(s) with duplicate receivings:\n`);

  let totalToDelete = 0;
  const deletionPlan = []; // { keepId, deleteIds, sourceOrderId, itemsSummary }

  for (const group of duplicates) {
    // Sort by createdAt ascending — keep OLDEST (first created), delete the rest
    const sorted = group.docs.sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );
    const keepDoc   = sorted[0];
    const deleteDocs = sorted.slice(1);
    const deleteIds  = deleteDocs.map((d) => d._id);

    totalToDelete += deleteIds.length;

    // Build a human-readable items summary
    const itemsSummary = (keepDoc.items || [])
      .map((i) => `${i.design || i.productCode || '?'} × ${i.quantity}`)
      .join(', ');

    deletionPlan.push({
      sourceOrderId: group._id,
      keepId:        keepDoc._id,
      keepCreatedAt: keepDoc.createdAt,
      deleteIds,
      itemsSummary,
      buyerName:     keepDoc.buyerName || keepDoc.supplierName || 'unknown',
      totalQuantity: (keepDoc.items || []).reduce((s, i) => s + (i.quantity || 0), 0),
    });

    console.log(
      `  🔑  sourceOrderId: ${group._id}\n` +
      `      Buyer/Supplier: ${deletionPlan.at(-1).buyerName}\n` +
      `      Items: ${itemsSummary || 'N/A'}\n` +
      `      Total qty: ${deletionPlan.at(-1).totalQuantity}\n` +
      `      Copies found: ${group.count}\n` +
      `      ✅  Keep:   _id=${keepDoc._id}  (created: ${keepDoc.createdAt})\n` +
      deleteIds.map(
        (id, idx) =>
          `      ❌  Delete: _id=${id}  (created: ${deleteDocs[idx].createdAt})`
      ).join('\n') + '\n'
    );
  }

  console.log(`\n📊  Summary:`);
  console.log(`    Affected sourceOrderIds : ${duplicates.length}`);
  console.log(`    Receivings to DELETE    : ${totalToDelete}`);
  console.log(`    Receivings to KEEP      : ${duplicates.length} (1 per order)\n`);

  if (DRY_RUN) {
    console.log('🛑  DRY RUN — nothing was changed.');
    console.log('    To apply the fix, run:');
    console.log('    DRY_RUN=false node scripts/fixDuplicateReceivings.js\n');
    await mongoose.disconnect();
    return;
  }

  // ── STEP 2: Delete duplicates (keep oldest per sourceOrderId) ──
  console.log('🔥  Applying fixes...\n');

  let deletedCount  = 0;
  let errorCount    = 0;
  const errorLog    = [];

  for (const plan of deletionPlan) {
    try {
      const result = await Receiving.deleteMany({
        _id: { $in: plan.deleteIds },
      });
      deletedCount += result.deletedCount;
      console.log(
        `  ✅  sourceOrderId ${plan.sourceOrderId}: deleted ${result.deletedCount} duplicate(s)`
      );
    } catch (err) {
      errorCount++;
      errorLog.push({ sourceOrderId: plan.sourceOrderId, error: err.message });
      console.error(`  ❌  sourceOrderId ${plan.sourceOrderId}: FAILED — ${err.message}`);
    }
  }

  // ── STEP 3: Verify — confirm no sourceOrderId has count > 1 ──
  console.log('\n🔍  Verifying cleanup...');
  const remaining = await Receiving.aggregate([
    { $match: { sourceOrderId: { $exists: true, $ne: null } } },
    { $group: { _id: '$sourceOrderId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  console.log('\n══════════════════════════════════════════════');
  console.log(`  Duplicates deleted : ${deletedCount}`);
  console.log(`  Errors             : ${errorCount}`);
  console.log(
    remaining.length === 0
      ? `  ✅  Verification PASSED — no duplicates remain`
      : `  ❌  Verification FAILED — ${remaining.length} sourceOrderId(s) still have duplicates`
  );

  if (errorLog.length > 0) {
    console.log('\n  Error details:');
    errorLog.forEach((e) => console.log(`    ${e.sourceOrderId}: ${e.error}`));
  }

  console.log('══════════════════════════════════════════════\n');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('💥  Fatal error:', err);
  mongoose.disconnect();
  process.exit(1);
});