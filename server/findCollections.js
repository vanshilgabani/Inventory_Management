const mongoose = require('mongoose');

// Replace with your MongoDB connection string
const MONGO_URI = 'mongodb://localhost:27017/InventoryManagement';

async function findCollections() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('📦 Connected to MongoDB\n');

    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    console.log('📋 Available Collections:');
    collections.forEach(col => {
      console.log(`  - ${col.name}`);
    });

    console.log('\n🔍 Searching for factory receiving data...\n');

    // Try different possible collection names
    const possibleNames = [
      'factoryreceivings',
      'factoryReceivings', 
      'factory_receivings',
      'receivings',
      'Receivings',
      'FactoryReceiving',
      'factoryreceiving'
    ];

    for (const name of possibleNames) {
      try {
        const collection = mongoose.connection.collection(name);
        const count = await collection.countDocuments();
        
        if (count > 0) {
          console.log(`✅ Found collection: "${name}" with ${count} documents`);
          
          // Show a sample document
          const sample = await collection.findOne({});
          console.log('\n📄 Sample document structure:');
          console.log(JSON.stringify(sample, null, 2));
          
          // Check for sourceName field
          const withSourceName = await collection.countDocuments({ 
            sourceName: { $exists: true } 
          });
          console.log(`\n🎯 Documents with sourceName: ${withSourceName}`);
          
          if (withSourceName > 0) {
            const samples = await collection.find({ 
              sourceName: { $exists: true } 
            }).limit(3).toArray();
            
            console.log('\n📋 Sample sourceNames:');
            samples.forEach(s => {
              console.log(`  - "${s.sourceName}" (${s.design} - ${s.color})`);
            });
          }
          
          break;
        }
      } catch (e) {
        // Collection doesn't exist, continue
      }
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

findCollections();
