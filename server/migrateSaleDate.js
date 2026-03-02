const mongoose = require('mongoose');
require('dotenv').config();

const MarketplaceSale = require('../server/src/models/MarketplaceSale');

const migrateSaleDate = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const feb25Start = new Date('2026-02-25T00:00:00.000Z');
    const feb25End   = new Date('2026-02-25T23:59:59.999Z');
    const feb26      = new Date('2026-02-26T00:00:00.000Z');

    // Step 1: Find all orders with saleDate on Feb 25
    const orders = await MarketplaceSale.find({
      saleDate: {
        $gte: feb25Start,
        $lte: feb25End
      }
    });

    console.log(`📊 Found ${orders.length} orders with saleDate on Feb 25`);

    if (orders.length === 0) {
      console.log('⚠️  No orders found. Exiting.');
      return;
    }

    // Preview before modifying
    console.log('\n📋 Orders to be updated:');
    orders.forEach((order, i) => {
      console.log(
        `  ${i + 1}. _id: ${order._id} | orderItemId: ${order.orderItemId} | account: ${order.accountName} | saleDate: ${order.saleDate.toISOString()}`
      );
    });

    // Step 2: Update all matching orders
    const result = await MarketplaceSale.updateMany(
      {
        saleDate: {
          $gte: feb25Start,
          $lte: feb25End
        }
      },
      {
        $set: { saleDate: feb26 }
      }
    );

    console.log(`\n✅ Migration completed!`);
    console.log(`📝 Matched:  ${result.matchedCount}`);
    console.log(`📝 Modified: ${result.modifiedCount}`);

    // Step 3: Verify — should be 0 remaining on Feb 25
    const remaining = await MarketplaceSale.countDocuments({
      saleDate: {
        $gte: feb25Start,
        $lte: feb25End
      }
    });
    console.log(`\n🔍 Remaining Feb 25 saleDates: ${remaining}`);

    // Step 4: Confirm Feb 26 count
    const feb26Start = new Date('2026-02-26T00:00:00.000Z');
    const feb26End   = new Date('2026-02-26T23:59:59.999Z');
    const feb26Count = await MarketplaceSale.countDocuments({
      saleDate: {
        $gte: feb26Start,
        $lte: feb26End
      }
    });
    console.log(`✅ Total orders now on Feb 26 saleDate: ${feb26Count}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

migrateSaleDate();
