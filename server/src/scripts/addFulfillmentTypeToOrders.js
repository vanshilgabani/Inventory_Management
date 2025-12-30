const mongoose = require('mongoose');
require('dotenv').config();

const addFulfillmentTypeToOrders = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    const ordersCollection = db.collection('wholesaleorders');
    
    // Update all existing orders to have fulfillmentType: 'warehouse'
    const result = await ordersCollection.updateMany(
      { fulfillmentType: { $exists: false } },
      { 
        $set: { 
          fulfillmentType: 'warehouse'
        } 
      }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} orders with default fulfillmentType`);
    console.log(`✅ Matched ${result.matchedCount} orders\n`);
    
    console.log('✅ Migration complete!');
    await mongoose.connection.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

addFulfillmentTypeToOrders();
