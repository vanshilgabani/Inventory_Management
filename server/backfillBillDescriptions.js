/**
 * One-time migration script — backfills item.description on all existing MonthlyBill documents
 * Run: node scripts/backfillBillDescriptions.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const MonthlyBill   = require('../server/src/models/MonthlyBill');
const WholesaleOrder = require('../server/src/models/WholesaleOrder');

// ── Helpers (same logic as controller) ───────────────────────────────────────
const buildDesignPriceMap = (orders) => {
  const designPriceMap = {};
  orders.forEach(order => {
    (order.items || []).forEach(item => {
      const design = (item.design || '').trim();
      const price  = item.pricePerUnit || 0;
      if (!design || price <= 0) return;
      if (!designPriceMap[design]) designPriceMap[design] = new Set();
      designPriceMap[design].add(price);
    });
  });
  const result = {};
  for (const [design, priceSet] of Object.entries(designPriceMap)) {
    result[design] = Array.from(priceSet).sort((a, b) => a - b);
  }
  return result;
};

const getArticleDescription = (design, price, designPriceSorted) => {
  if (!design) return null; // null = skip, keep existing or leave blank
  const match = design.match(/[Dd](\d+)/);
  if (!match) return null;

  const padded     = match[1].padStart(2, '0');
  const prices     = designPriceSorted[design] || [price];
  const priceIndex = prices.indexOf(price);

  if (priceIndex <= 0) return `Cargo Pants #${padded}`;
  const suffix = String.fromCharCode(65 + priceIndex - 1);
  return `Cargo Pants #${padded}${suffix}`;
};

// ── Main migration ────────────────────────────────────────────────────────────
const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const bills = await MonthlyBill.find({}).lean();
  console.log(`📋 Found ${bills.length} bills to process\n`);

  let updatedBills   = 0;
  let skippedBills   = 0;
  let updatedItems   = 0;
  let failedBills    = 0;

  for (const bill of bills) {
    try {
      // Collect all real challanIds from this bill (skip PREV-ADJ)
      const challanIds = bill.challans
        .map(c => c.challanId)
        .filter(Boolean);

      // Fetch original orders for design info
      const orders = await WholesaleOrder.find({
        _id: { $in: challanIds }
      }).lean();

      if (orders.length === 0) {
        console.log(`⚠️  Bill ${bill.billNumber} — no orders found, skipping`);
        skippedBills++;
        continue;
      }

      // Build design→price map from original orders
      const designPriceSorted = buildDesignPriceMap(orders);
      const orderMap = new Map(orders.map(o => [o._id.toString(), o]));

      let billModified = false;

      // Process each challan
      const updatedChallans = bill.challans.map(challan => {
        // Handle PREV-ADJ challan
        if (challan.challanNumber === 'PREV-ADJ') {
          const updatedItems = challan.items.map(item => ({
            ...item,
            description: 'Cargo Pants #101'
          }));
          return { ...challan, items: updatedItems };
        }

        const order = orderMap.get(challan.challanId?.toString());
        if (!order) return challan; // can't resolve — leave as is

        // Match bill items to order items by index (same order preserved)
        const updatedChallanItems = challan.items.map((billItem, idx) => {
          // Already has a description — skip
          if (billItem.description) return billItem;

          // Match via index first, then fallback price+color+size
          const orderItem = order.items[idx] || order.items.find(
            oi => oi.pricePerUnit === billItem.price
              && oi.color === billItem.color
              && oi.size  === billItem.size
          );

          if (!orderItem) return billItem;

          const design      = (orderItem.design || '').trim();
          const description = getArticleDescription(design, billItem.price, designPriceSorted);

          if (!description) return billItem; // no D-number design, skip

          billModified = true;
          updatedItems++;
          return { ...billItem, description };
        });

        return { ...challan, items: updatedChallanItems };
      });

      if (!billModified) {
        skippedBills++;
        continue; // nothing changed
      }

      // Write back to DB
      await MonthlyBill.findByIdAndUpdate(bill._id, {
        $set: { challans: updatedChallans }
      });

      updatedBills++;
      console.log(`✅ Bill ${bill.billNumber} — updated`);

    } catch (err) {
      failedBills++;
      console.error(`❌ Bill ${bill.billNumber} failed:`, err.message);
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────');
  console.log('Migration complete');
  console.log(`  Bills updated  : ${updatedBills}`);
  console.log(`  Bills skipped  : ${skippedBills}`);
  console.log(`  Items updated  : ${updatedItems}`);
  console.log(`  Bills failed   : ${failedBills}`);
  console.log('─────────────────────────────────');

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});