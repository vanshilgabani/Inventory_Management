// scripts/migrateChallanCounters.js
require('dotenv').config();
const mongoose = require('mongoose');
const WholesaleBuyer = require('../server/src/models/WholesaleBuyer');
const WholesaleOrder = require('../server/src/models/WholesaleOrder');

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Starting challanCounter migration...');

  const buyers = await WholesaleBuyer.find({
    $or: [
      { challanCounter: { $exists: false } },
      { challanCounter: 0 },
    ],
  }).lean();

  console.log(`Found ${buyers.length} buyers to migrate.`);

  let fixed = 0;
  for (const buyer of buyers) {
    const orderCount = await WholesaleOrder.countDocuments({
      buyerId: buyer._id,
      deletedAt: null,
    });

    await WholesaleBuyer.findByIdAndUpdate(buyer._id, {
      $set: { challanCounter: orderCount },
    });

    console.log(`✅ ${buyer.name} (${buyer.mobile}): challanCounter set to ${orderCount}`);
    fixed++;
  }

  console.log(`\nMigration complete. Fixed ${fixed} buyers.`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});