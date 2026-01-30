const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/your_db';

async function migrate() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected!');

    const db = mongoose.connection.db;
    const collection = db.collection('marketplaceskumappings');

    // Step 1: Drop old index
    console.log('🗑️ Dropping old index...');
    try {
      await collection.dropIndex('organizationId_1_accountName_1_marketplaceSKU_1');
      console.log('✅ Old index dropped');
    } catch (error) {
      console.log('⚠️ Old index not found (might already be dropped)');
    }

    // Step 2: Create new index
    console.log('📝 Creating new index...');
    await collection.createIndex(
      { organizationId: 1, marketplaceSKU: 1 },
      { unique: true }
    );
    console.log('✅ New index created');

    // Step 3: Find duplicates
    console.log('🔍 Checking for duplicates...');
    const duplicates = await collection.aggregate([
      {
        $group: {
          _id: { organizationId: "$organizationId", marketplaceSKU: "$marketplaceSKU" },
          count: { $sum: 1 },
          mappings: { $push: "$$ROOT" }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]).toArray();

    console.log(`📋 Found ${duplicates.length} duplicate groups`);

    // Step 4: Merge duplicates
    if (duplicates.length > 0) {
      console.log('🔄 Merging duplicates...');
      
      for (const group of duplicates) {
        // Sort by last used date (keep most recent)
        const sorted = group.mappings.sort((a, b) => 
          new Date(b.lastUsedAt) - new Date(a.lastUsedAt)
        );

        const keep = sorted[0];
        const remove = sorted.slice(1);

        console.log(`  Keeping: ${keep._id} | Removing: ${remove.length} duplicates`);

        for (const dup of remove) {
          await collection.deleteOne({ _id: dup._id });
        }
      }
      
      console.log('✅ Duplicates merged');
    } else {
      console.log('✅ No duplicates found');
    }

    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

migrate();
