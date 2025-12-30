require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const YOUR_ORG_ID = '6948da9a668faa0e351eae65';

async function fixColorPalette() {
  try {
    if (!MONGO_URI) {
      console.error('❌ MongoDB URI not found in .env file!');
      process.exit(1);
    }

    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const settingsCollection = db.collection('settings');

    // Find YOUR organization's settings document (organizationId as string)
    console.log(`\n🔍 Looking for settings with organizationId: ${YOUR_ORG_ID}`);
    const settingsDoc = await settingsCollection.findOne({
      organizationId: YOUR_ORG_ID
    });
    
    if (!settingsDoc) {
      console.log('❌ No settings document found for this organization');
      await mongoose.connection.close();
      return;
    }

    console.log('✅ Found settings document for your organization');
    console.log('Document _id:', settingsDoc._id);
    console.log('Organization ID:', settingsDoc.organizationId);

    // Check for colorPalette field
    if (!settingsDoc.colorPalette) {
      console.log('\n❌ No colorPalette field found in this settings document');
      await mongoose.connection.close();
      return;
    }

    console.log('\n✅ Found colorPalette field');
    console.log('Number of colors:', settingsDoc.colorPalette.length);
    console.log('\n📋 First color BEFORE update:');
    console.log(JSON.stringify(settingsDoc.colorPalette[0], null, 2));

    // Update the colorPalette for THIS organization only
    console.log('\n🔧 Updating colorPalette for your organization...');
    const result = await settingsCollection.updateOne(
      { 
        _id: settingsDoc._id,
        organizationId: YOUR_ORG_ID
      },
      {
        $set: {
          "colorPalette.$[].availableForDesigns": [],
          "colorPalette.$[].isActive": true
        }
      }
    );

    console.log(`✅ Modified ${result.modifiedCount} document(s)`);

    // Verify the update
    const updatedDoc = await settingsCollection.findOne({ _id: settingsDoc._id });
    console.log('\n📋 First color AFTER update:');
    console.log(JSON.stringify(updatedDoc.colorPalette[0], null, 2));
    
    console.log('\n✅ SUCCESS! All colors updated for your organization!');
    console.log('🎨 All', updatedDoc.colorPalette.length, 'colors are now available for all designs.');
    console.log('\nUpdated colors:');
    updatedDoc.colorPalette.forEach((color, i) => {
      console.log(`  ${i + 1}. ${color.colorName} - availableForDesigns: ${JSON.stringify(color.availableForDesigns)}, isActive: ${color.isActive}`);
    });

    await mongoose.connection.close();
    console.log('\n✅ Connection closed');
    console.log('\n🎉 Now refresh your frontend and all colors should appear!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixColorPalette();
