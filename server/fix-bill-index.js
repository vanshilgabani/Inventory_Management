const mongoose = require('mongoose');
const MonthlyBill = require('../server/src/models/MonthlyBill');

const fixIndex = async () => {
  try {
    // Connect to your database
    await mongoose.connect('mongodb+srv://vanshilgabani:dharmajivanv1@inventorymanagement.4bk0m5j.mongodb.net/InventoryManagement?retryWrites=true&w=majority');
    
    console.log('Connected to MongoDB...');
    
    // Get all indexes
    const indexes = await MonthlyBill.collection.getIndexes();
    console.log('Current indexes:', Object.keys(indexes));
    
    // Drop the problematic index if it exists
    try {
      await MonthlyBill.collection.dropIndex('billNumber_1');
      console.log('✅ Dropped billNumber_1 index');
    } catch (err) {
      if (err.message.includes('index not found')) {
        console.log('✅ billNumber_1 index does not exist (already fixed)');
      } else {
        throw err;
      }
    }
    
    // Verify final indexes
    const finalIndexes = await MonthlyBill.collection.getIndexes();
    console.log('\n✅ Final indexes:', Object.keys(finalIndexes));
    
    console.log('\n✅ All done! You can now generate bills.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

fixIndex();
