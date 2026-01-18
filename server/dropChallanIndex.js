/**
 * ONE-TIME SCRIPT: Drop old challan unique index
 * Run this script once before starting the server with the new partial index
 * 
 * Usage: node dropChallanIndex.js
 */

const mongoose = require('mongoose');
require('dotenv').config(); // Load environment variables

const dropOldChallanIndex = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ MongoDB connected successfully');
    console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
    
    // Get the wholesaleorders collection
    const collection = mongoose.connection.db.collection('wholesaleorders');
    
    console.log('\n🔍 Checking existing indexes...');
    
    // Get all indexes
    const indexes = await collection.indexes();
    console.log('📋 Current indexes:');
    indexes.forEach(index => {
      console.log(`   - ${index.name}`);
    });
    
    // Check if the old index exists
    const oldIndexExists = indexes.some(
      index => index.name === 'challanNumber_1_organizationId_1'
    );
    
    if (!oldIndexExists) {
      console.log('\n✅ Old index not found - already dropped or never existed');
      console.log('ℹ️  You can proceed with starting your server');
      await mongoose.connection.close();
      process.exit(0);
    }
    
    console.log('\n🗑️  Dropping old index: challanNumber_1_organizationId_1');
    
    // Drop the old index
    await collection.dropIndex('challanNumber_1_organizationId_1');
    
    console.log('✅ Old index dropped successfully!');
    
    // Verify it's gone
    const updatedIndexes = await collection.indexes();
    const stillExists = updatedIndexes.some(
      index => index.name === 'challanNumber_1_organizationId_1'
    );
    
    if (stillExists) {
      console.log('⚠️  Warning: Index still exists after drop attempt');
    } else {
      console.log('✅ Verified: Index successfully removed');
    }
    
    console.log('\n📋 Remaining indexes:');
    updatedIndexes.forEach(index => {
      console.log(`   - ${index.name}`);
    });
    
    console.log('\n✨ Done! Next steps:');
    console.log('   1. Start your server: npm run dev');
    console.log('   2. New partial index will be created automatically');
    console.log('   3. Test creating orders with reused challan numbers');
    
    // Close connection
    await mongoose.connection.close();
    console.log('\n✅ MongoDB connection closed');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error occurred:', error.message);
    
    if (error.code === 27) {
      console.log('ℹ️  Index not found (already dropped)');
    } else if (error.message.includes('not found')) {
      console.log('ℹ️  Index does not exist');
    } else {
      console.error('❌ Unexpected error:', error);
    }
    
    // Close connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    
    process.exit(1);
  }
};

// Run the script
console.log('🚀 Starting index drop script...\n');
dropOldChallanIndex();
