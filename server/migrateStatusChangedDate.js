const mongoose = require('mongoose');
require('dotenv').config();

const MarketplaceSale = require('../server/src/models/MarketplaceSale');

const migrateStatusChangedDate = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const feb25Start = new Date('2026-02-25T00:00:00.000Z');
    const feb25End   = new Date('2026-02-25T23:59:59.999Z');
    const feb24      = new Date('2026-02-24T00:00:00.000Z');

    // Step 1: Find all orders that have a statusHistory entry with changedAt on Feb 25
    const orders = await MarketplaceSale.find({
      'statusHistory.changedAt': {
        $gte: feb25Start,
        $lte: feb25End
      }
    });

    console.log(`📊 Found ${orders.length} orders with Feb 25 status change`);

    let modifiedCount = 0;

    for (const order of orders) {
      let modified = false;

      order.statusHistory = order.statusHistory.map((entry) => {
        const changedAt = new Date(entry.changedAt);
        if (changedAt >= feb25Start && changedAt <= feb25End) {
          entry.changedAt = feb24;
          modified = true;
        }
        return entry;
      });

      if (modified) {
        await order.save();
        modifiedCount++;
      }
    }

    console.log(`✅ Migration completed!`);
    console.log(`📝 Modified orders: ${modifiedCount}`);

    // Verify
    const remaining = await MarketplaceSale.countDocuments({
      'statusHistory.changedAt': {
        $gte: feb25Start,
        $lte: feb25End
      }
    });
    console.log(`🔍 Remaining Feb 25 status entries: ${remaining}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

migrateStatusChangedDate();
