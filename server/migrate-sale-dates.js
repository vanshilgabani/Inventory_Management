const mongoose = require('mongoose');
require('dotenv').config();

const MarketplaceSale = require('../server/src/models/MarketplaceSale');

const migrateSaleDates = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const jan18Start = new Date('2026-01-18T00:00:00.000Z');
    const jan18End = new Date('2026-01-18T23:59:59.999Z');
    const jan19 = new Date('2026-01-19T00:00:00.000Z');

    const result = await MarketplaceSale.updateMany(
      {
        saleDate: {
          $gte: jan18Start,
          $lte: jan18End
        }
      },
      {
        $set: { saleDate: jan19 }
      }
    );

    console.log(`✅ Migration completed successfully!`);
    console.log(`📊 Matched documents: ${result.matchedCount}`);
    console.log(`📝 Modified documents: ${result.modifiedCount}`);

    const verifyCount = await MarketplaceSale.countDocuments({
      saleDate: {
        $gte: jan18Start,
        $lte: jan18End
      }
    });
    console.log(`🔍 Remaining Jan 18 orders: ${verifyCount}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

migrateSaleDates();
