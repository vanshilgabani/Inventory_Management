const mongoose = require('mongoose');
require('dotenv').config();

const addStatusToSales = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    const salesCollection = db.collection('marketplacesales');
    
    // Update all sales to have status: 'completed'
    const result = await salesCollection.updateMany(
      { status: { $exists: false } },
      { 
        $set: { 
          status: 'completed',
          statusChangedBy: null,
          statusChangedAt: null
        } 
      }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} sales with default status`);
    console.log(`✅ Matched ${result.matchedCount} sales\n`);
    
    console.log('✅ Migration complete!');
    await mongoose.connection.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  }
};

addStatusToSales();
