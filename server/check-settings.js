const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

async function checkSettings() {
  try {
    if (!MONGO_URI) {
      console.error('❌ MONGO_URI not found in .env file!');
      process.exit(1);
    }

    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('📚 Collections in database:');
    collections.forEach(col => console.log(`   - ${col.name}`));
    console.log('');

    // Get settings collection
    const settingsCollection = db.collection('settings');
    const count = await settingsCollection.countDocuments();
    console.log(`📊 Total settings documents: ${count}\n`);

    // Get all settings
    const allSettings = await settingsCollection.find({}).toArray();
    
    if (allSettings.length === 0) {
      console.log('❌ No settings documents found!');
    } else {
      allSettings.forEach((setting, index) => {
        console.log(`\n========== Document ${index + 1} ==========`);
        console.log(`_id: ${setting._id}`);
        console.log(`organizationId: ${setting.organizationId}`);
        console.log(`companyName: ${setting.companyName || 'N/A'}`);
        console.log(`gstNumber: ${setting.gstNumber || 'N/A'}`);
        console.log(`address: ${setting.address || 'N/A'}`);
        console.log(`phone: ${setting.phone || 'N/A'}`);
        console.log(`email: ${setting.email || 'N/A'}`);
        console.log(`companies: ${JSON.stringify(setting.companies || [], null, 2)}`);
      });
    }

    await mongoose.connection.close();
    console.log('\n🔌 Connection closed');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkSettings();
