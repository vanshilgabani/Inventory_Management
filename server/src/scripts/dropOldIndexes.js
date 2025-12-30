const mongoose = require('mongoose');
require('dotenv').config();

const dropOldIndexes = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    const salesCollection = db.collection('marketplacesales');
    
    console.log('🔍 Checking existing indexes...');
    const indexes = await salesCollection.indexes();
    console.log('Current indexes:', indexes.map(i => i.name));
    
    // Drop the orderId index
    try {
      console.log('\n🗑️  Dropping orderId_1 index...');
      await salesCollection.dropIndex('orderId_1');
      console.log('✅ Dropped orderId_1 index');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️  Index orderId_1 does not exist, skipping...');
      } else {
        throw error;
      }
    }
    
    console.log('\n✅ Index cleanup complete!');
    await mongoose.connection.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  }
};

dropOldIndexes();
