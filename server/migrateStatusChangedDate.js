const mongoose = require('mongoose');
require('dotenv').config();

const MarketplaceSale = require('../server/src/models/MarketplaceSale');

const migrateStatusChangedDate = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const apr03Start = new Date('2026-04-04T00:00:00.000Z');
    const apr03End   = new Date('2026-04-04T23:59:59.999Z');
    const apr02      = new Date('2026-04-03T00:00:00.000Z');

    // Fetch only orders with a 'returned' status entry on Apr 03
    const orders = await MarketplaceSale.find({
      statusHistory: {
        $elemMatch: {
          status: 'returned',
          changedAt: { $gte: apr03Start, $lte: apr03End }
        }
      }
    });

    console.log(`📊 Found ${orders.length} orders with 'returned' status on Apr 03`);

    let modifiedCount = 0;

    for (const order of orders) {
      let modified = false;

      order.statusHistory = order.statusHistory.map((entry) => {
        const changedAt = new Date(entry.changedAt);
        if (
          changedAt >= apr03Start &&
          changedAt <= apr03End &&
          entry.status === 'returned'
        ) {
          entry.changedAt = apr02;
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
      statusHistory: {
        $elemMatch: {
          status: 'returned',
          changedAt: { $gte: apr03Start, $lte: apr03End }
        }
      }
    });
    console.log(`🔍 Remaining Apr 03 'returned' entries: ${remaining}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

migrateStatusChangedDate();