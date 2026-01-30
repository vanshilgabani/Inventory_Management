// force-update-dates.js
const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://vanshilgabani:dharmajivanv1@inventorymanagement.4bk0m5j.mongodb.net/InventoryManagement?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI).then(async () => {
  console.log('✅ Connected to MongoDB');
  
  const Sale = mongoose.model('MarketplaceSale', new mongoose.Schema({}, {strict: false}), 'marketplacesales');
  
  // Direct MongoDB updateMany with aggregation pipeline
  const result = await Sale.collection.updateMany(
    {
      status: { $in: ['returned', 'cancelled', 'wrongreturn'] },
      'statusHistory.changedAt': { 
        $gte: new Date('2026-01-28T00:00:00.000Z'), 
        $lt: new Date('2026-01-29T00:00:00.000Z') 
      }
    },
    [
      {
        $set: {
          statusHistory: {
            $map: {
              input: '$statusHistory',
              as: 'history',
              in: {
                $mergeObjects: [
                  '$$history',
                  {
                    changedAt: {
                      $cond: {
                        if: {
                          $and: [
                            { $gte: ['$$history.changedAt', new Date('2026-01-28T00:00:00.000Z')] },
                            { $lt: ['$$history.changedAt', new Date('2026-01-29T00:00:00.000Z')] }
                          ]
                        },
                        then: { $subtract: ['$$history.changedAt', 86400000] }, // Subtract 1 day
                        else: '$$history.changedAt'
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      }
    ]
  );
  
  console.log(`\n✅ Matched: ${result.matchedCount} orders`);
  console.log(`✅ Modified: ${result.modifiedCount} orders`);
  console.log('\n🎉 All changedAt dates from Jan 28 changed to Jan 27!');
  
  await mongoose.connection.close();
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err.message);
  console.error(err);
  process.exit(1);
});
