// update-dates-simple.js
const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://vanshilgabani:dharmajivanv1@inventorymanagement.4bk0m5j.mongodb.net/InventoryManagement?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI).then(async () => {
  console.log('✅ Connected');
  
  const Sale = mongoose.model('MarketplaceSale', new mongoose.Schema({}, {strict: false}), 'marketplacesales');
  
  // Update: Change returnDate from Jan 28 to Jan 27
  const result = await Sale.updateMany(
    {
      status: { $in: ['returned', 'cancelled', 'wrongreturn'] },
      returnDate: { $gte: new Date('2026-01-28'), $lt: new Date('2026-01-29') }
    },
    [{ 
      $set: { 
        returnDate: { $subtract: ['$returnDate', 86400000] } // Subtract 1 day
      } 
    }]
  );
  
  console.log(`✅ Updated ${result.modifiedCount} orders`);
  
  await mongoose.connection.close();
  process.exit(0);
}).catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
