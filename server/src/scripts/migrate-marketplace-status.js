const mongoose = require('mongoose');
const path = require('path');

// Load environment variables from correct path
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// MongoDB connection - check multiple possible env var names
const MONGODB_URI = process.env.MONGODB_URI || 
                    process.env.MONGO_URI || 
                    process.env.DATABASE_URL ||
                    process.env.DB_URI;

const migrationScript = async () => {
  try {
    console.log('🔄 Starting migration: completed → delivered');
    
    // Validate MongoDB URI
    if (!MONGODB_URI) {
      console.error('❌ ERROR: MongoDB connection string not found!');
      console.error('Please check your .env file has one of these:');
      console.error('  - MONGODB_URI');
      console.error('  - MONGO_URI');
      console.error('  - DATABASE_URL');
      console.error('  - DB_URI');
      console.error('\nCurrent .env location:', path.join(__dirname, '../../.env'));
      process.exit(1);
    }

    if (!MONGODB_URI.startsWith('mongodb://') && !MONGODB_URI.startsWith('mongodb+srv://')) {
      console.error('❌ ERROR: Invalid MongoDB connection string format');
      console.error('Expected format: mongodb://... or mongodb+srv://...');
      console.error('Current value starts with:', MONGODB_URI.substring(0, 20) + '...');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    console.log('Using connection string:', MONGODB_URI.substring(0, 30) + '...' + MONGODB_URI.substring(MONGODB_URI.length - 10));
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('marketplacesales');

    // Step 1: Count existing "completed" status
    const completedCount = await collection.countDocuments({ 
      status: 'completed'
    });
    
    console.log(`\n📊 Found ${completedCount} orders with status "completed"`);

    if (completedCount === 0) {
      console.log('✅ No orders to migrate. All done!');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Step 2: Show sample data before migration
    console.log('\n📋 Sample orders before migration:');
    const sampleBefore = await collection.find({ status: 'completed' })
      .limit(5)
      .project({ _id: 1, accountName: 1, design: 1, color: 1, status: 1, quantity: 1 })
      .toArray();
    
    sampleBefore.forEach((order, index) => {
      console.log(`   ${index + 1}. ID: ${order._id}`);
      console.log(`      Account: ${order.accountName}, Design: ${order.design}, Color: ${order.color}`);
      console.log(`      Status: ${order.status}, Quantity: ${order.quantity}`);
    });

    // Step 3: Confirm migration
    console.log(`\n⚠️  About to update ${completedCount} orders from "completed" to "delivered"`);
    console.log('⚠️  NO STOCK WILL BE DEDUCTED (direct database update)');
    
    // Add a 3-second delay for user to cancel (Ctrl+C)
    console.log('\n⏳ Starting in 3 seconds... (Press Ctrl+C to cancel)');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 4: Perform migration
    console.log('\n🚀 Migrating...');
    const result = await collection.updateMany(
      { status: 'completed' },
      { $set: { status: 'delivered' } }
    );

    console.log(`\n✅ Migration completed successfully!`);
    console.log(`   - Matched: ${result.matchedCount} orders`);
    console.log(`   - Updated: ${result.modifiedCount} orders`);

    // Step 5: Verify migration
    console.log('\n🔍 Verifying migration...');
    
    const remainingCompleted = await collection.countDocuments({ 
      status: 'completed'
    });
    
    const deliveredCount = await collection.countDocuments({ 
      status: 'delivered'
    });

    console.log(`   - Remaining "completed": ${remainingCompleted}`);
    console.log(`   - Total "delivered": ${deliveredCount}`);

    // Step 6: Show sample data after migration
    console.log('\n📋 Sample orders after migration:');
    const sampleAfter = await collection.find({ status: 'delivered' })
      .sort({ updatedAt: -1 })
      .limit(5)
      .project({ _id: 1, accountName: 1, design: 1, color: 1, status: 1, quantity: 1 })
      .toArray();
    
    sampleAfter.forEach((order, index) => {
      console.log(`   ${index + 1}. ID: ${order._id}`);
      console.log(`      Account: ${order.accountName}, Design: ${order.design}, Color: ${order.color}`);
      console.log(`      Status: ${order.status}, Quantity: ${order.quantity}`);
    });

    console.log('\n✨ Migration completed successfully!');
    console.log('✅ All "completed" orders are now "delivered"');
    console.log('✅ No stock was deducted');
    console.log('✅ You can now manually adjust individual orders as needed');

    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

// Run migration
migrationScript();
