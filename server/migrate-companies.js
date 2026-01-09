const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

async function migrateCompanies() {
  try {
    if (!MONGO_URI) {
      console.error('❌ MONGO_URI not found in .env file!');
      process.exit(1);
    }

    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const settingsCollection = db.collection('settings');

    // Find ALL settings documents where companies array is empty (length = 0)
    const settingsToMigrate = await settingsCollection.find({
      companyName: { $exists: true, $ne: '' },
      companies: { $size: 0 }  // ✅ FIX: This checks for empty array []
    }).toArray();

    console.log(`📊 Found ${settingsToMigrate.length} document(s) to migrate`);

    if (settingsToMigrate.length === 0) {
      console.log('⚠️ No documents found with empty companies array.');
      
      // Check if companies arrays already have data
      const withCompanies = await settingsCollection.find({
        companies: { $exists: true, $not: { $size: 0 } }
      }).toArray();
      
      console.log(`\n✅ ${withCompanies.length} document(s) already have companies data.`);
      
      await mongoose.connection.close();
      return;
    }

    // Migrate each document
    let migratedCount = 0;
    for (const setting of settingsToMigrate) {
      console.log(`\n🔄 Migrating document: ${setting._id}`);
      console.log(`   Organization: ${setting.organizationId}`);
      console.log(`   Company: ${setting.companyName}`);
      console.log(`   GST: ${setting.gstNumber || 'N/A'}`);
      console.log(`   Phone: ${setting.phone || 'N/A'}`);
      console.log(`   Email: ${setting.email || 'N/A'}`);

      const newCompany = {
        id: 'company1',
        name: setting.companyName || 'My Company',
        legalName: setting.companyName || 'My Company',
        gstin: setting.gstNumber || '',
        pan: '',
        address: {
          line1: setting.address || '',
          line2: '',
          city: 'Surat',
          state: 'Gujarat',
          pincode: '',
          stateCode: '24'
        },
        contact: {
          phone: setting.phone || '',
          email: setting.email || ''
        },
        bank: {
          name: '',
          accountNo: '',
          ifsc: '',
          branch: ''
        },
        logo: '',
        isDefault: true,
        isActive: true
      };

      const result = await settingsCollection.updateOne(
        { _id: setting._id },
        { $set: { companies: [newCompany] } }
      );

      console.log(`   ✅ Migrated! Modified: ${result.modifiedCount}`);
      migratedCount++;
    }

    console.log(`\n🎉 Migration completed! ${migratedCount} document(s) migrated.`);
    console.log('🔄 Please refresh your browser to see the companies!');
    
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateCompanies();
