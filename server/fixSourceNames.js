require('dotenv').config(); // Load .env file
const mongoose = require('mongoose');

// Read from .env file
const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URI || process.env.DATABASE_URL;

if (!MONGO_URI) {
  console.error('❌ Error: MongoDB URI not found in .env file');
  console.log('💡 Make sure you have one of these in your .env file:');
  console.log('   - MONGODB_URI=...');
  console.log('   - MONGO_URI=...');
  console.log('   - DATABASE_URL=...');
  process.exit(1);
}

async function fixSourceNames() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('📦 Connected to MongoDB');

    const dbName = mongoose.connection.db.databaseName;
    console.log(`🗄️  Database: ${dbName}\n`);

    // Try to find the correct collection name
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    let collectionName = 'factoryreceivings'; // default
    
    // Find the right collection
    const possibleNames = [
      'factoryreceivings',
      'factoryReceivings', 
      'factory_receivings',
      'receivings'
    ];
    
    for (const name of possibleNames) {
      if (collectionNames.includes(name)) {
        const col = mongoose.connection.collection(name);
        const count = await col.countDocuments({ sourceName: { $exists: true } });
        if (count > 0) {
          collectionName = name;
          console.log(`✅ Using collection: "${collectionName}"\n`);
          break;
        }
      }
    }

    const FactoryReceiving = mongoose.connection.collection(collectionName);

    // Find all documents with sourceName
    const documents = await FactoryReceiving.find({
      sourceName: { $exists: true, $ne: null }
    }).toArray();

    console.log(`📊 Found ${documents.length} documents with sourceName\n`);

    if (documents.length === 0) {
      console.log('⚠️  No documents found with sourceName field');
      console.log('💡 This could mean:');
      console.log('   1. The collection is empty');
      console.log('   2. The field name is different (check your schema)');
      console.log('   3. Wrong collection name');
      await mongoose.disconnect();
      return;
    }

    let updatedCount = 0;

    // Update each document
    for (const doc of documents) {
      const originalName = doc.sourceName;
      const lowerName = originalName.toLowerCase();

      if (originalName !== lowerName) {
        await FactoryReceiving.updateOne(
          { _id: doc._id },
          { $set: { sourceName: lowerName } }
        );
        console.log(`✅ Updated: "${originalName}" → "${lowerName}"`);
        updatedCount++;
      } else {
        console.log(`⏭️  Skipped: "${originalName}" (already lowercase)`);
      }
    }

    console.log(`\n🎉 Done! Updated ${updatedCount} out of ${documents.length} records.`);
    
    // Show some examples
    const samples = await FactoryReceiving.find({
      sourceName: { $exists: true }
    }).limit(5).toArray();
    
    console.log('\n📋 Sample records after update:');
    samples.forEach(s => {
      console.log(`  - ${s.design} (${s.color}) from "${s.sourceName}"`);
    });

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixSourceNames();
