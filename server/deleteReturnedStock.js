require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;

if (!MONGO_URI) {
  console.error('❌ Error: MongoDB URI not found in .env file');
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

async function clearReturnedQuantities() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('📦 Connected to MongoDB\n');

    const dbName = mongoose.connection.db.databaseName;
    console.log(`🗄️  Database: ${dbName}\n`);

    const FactoryReceiving = mongoose.connection.collection('factoryreceivings');

    // Define date range for 26/12/2025 (full day)
    const startDate = new Date('2025-12-26T00:00:00.000Z');
    const endDate = new Date('2025-12-26T23:59:59.999Z');

    console.log('📅 Searching for RETURNED stock on 26/12/2025...\n');

    // Find all returned stock on this date
    const returnedStock = await FactoryReceiving.find({
      borrowStatus: 'returned',
      $or: [
        { receivedDate: { $gte: startDate, $lte: endDate } },
        { returnedDate: { $gte: startDate, $lte: endDate } },
        { createdAt: { $gte: startDate, $lte: endDate } }
      ]
    }).toArray();

    if (returnedStock.length === 0) {
      console.log('✅ No returned stock found on 26/12/2025');
      await mongoose.disconnect();
      rl.close();
      return;
    }

    console.log(`🔍 Found ${returnedStock.length} returned stock items:\n`);
    console.log('═'.repeat(80));

    let totalQuantityBeforeClearing = 0;

    // Display details of each item
    returnedStock.forEach((item, index) => {
      console.log(`\n📦 Item ${index + 1}:`);
      console.log(`   ID: ${item._id}`);
      console.log(`   Design: ${item.design}`);
      console.log(`   Color: ${item.color}`);
      console.log(`   Source: ${item.sourceName || 'N/A'} (${item.sourceType})`);
      console.log(`   Current Borrow Status: ${item.borrowStatus}`);
      console.log(`   ➡️  Will change to: active`);
      
      // Calculate quantities
      const quantities = item.quantities instanceof Map 
        ? Object.fromEntries(item.quantities) 
        : item.quantities;
      
      const qty = Object.values(quantities || {}).reduce((sum, q) => sum + (q || 0), 0);
      totalQuantityBeforeClearing += qty;
      
      console.log(`   Current Quantity: ${qty} units`);
      console.log(`   Current Sizes: ${JSON.stringify(quantities)}`);
      console.log(`   ➡️  Will become: 0 units (empty quantities)`);
      console.log(`   Returned Quantity: ${item.returnedQuantity || 0}`);
      console.log(`   Received Date: ${item.receivedDate ? new Date(item.receivedDate).toLocaleString('en-IN') : 'N/A'} ✅ KEEP`);
      console.log(`   Returned Date: ${item.returnedDate ? new Date(item.returnedDate).toLocaleString('en-IN') : 'N/A'} ❌ DELETE`);
      console.log(`   Batch ID: ${item.batchId || 'N/A'} ✅ KEEP`);
      console.log(`   Notes: ${item.notes || 'N/A'} ✅ KEEP`);
    });

    console.log('\n' + '═'.repeat(80));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Items: ${returnedStock.length}`);
    console.log(`   Total Quantity to Clear: ${totalQuantityBeforeClearing} units`);
    console.log(`   Date: 26/12/2025`);
    console.log(`\n   🔄 Changes to be made:`);
    console.log(`      1. quantities → {} (empty)`);
    console.log(`      2. totalQuantity → 0`);
    console.log(`      3. borrowStatus → 'active' (was 'returned')`);
    console.log(`      4. returnedDate → DELETED`);
    console.log(`      5. returnedQuantity → 0`);
    console.log(`      6. returnedQuantities → {}`);
    console.log(`\n   ✅ Keep all other fields unchanged`);
    console.log('\n' + '═'.repeat(80));

    // Ask for confirmation
    console.log('\n⚠️  This will RESET these orders to ACTIVE status!');
    const answer = await askQuestion('\n❓ Do you want to proceed? (yes/no): ');

    if (answer.toLowerCase() !== 'yes') {
      console.log('\n❌ Operation cancelled by user');
      await mongoose.disconnect();
      rl.close();
      return;
    }

    // Perform update
    console.log('\n🔄 Updating records...\n');

    let updatedCount = 0;

    for (const item of returnedStock) {
      // Update: Clear quantities, change status to active, remove returnedDate
      const updateResult = await FactoryReceiving.updateOne(
        { _id: item._id },
        {
          $set: {
            quantities: {},
            totalQuantity: 0,
            borrowStatus: 'active',  // Change from 'returned' to 'active'
            returnedQuantity: 0,
            returnedQuantities: {}
          },
          $unset: {
            returnedDate: ""  // Remove returnedDate field
          }
        }
      );

      if (updateResult.modifiedCount > 0) {
        updatedCount++;
        console.log(`✅ Updated ${item.design} - ${item.color} (ID: ${item._id})`);
        console.log(`   - Cleared quantities`);
        console.log(`   - Status: returned → active`);
        console.log(`   - Removed returnedDate field`);
      }
    }

    console.log(`\n✅ Successfully updated ${updatedCount} items!\n`);

    // Show updated records summary
    console.log('📋 Updated Items Summary:');
    const summary = {};
    returnedStock.forEach(item => {
      const key = `${item.design} - ${item.color}`;
      if (!summary[key]) {
        summary[key] = { count: 0, clearedQty: 0, source: item.sourceName };
      }
      summary[key].count++;
      const quantities = item.quantities instanceof Map 
        ? Object.fromEntries(item.quantities) 
        : item.quantities;
      summary[key].clearedQty += Object.values(quantities || {}).reduce((sum, q) => sum + (q || 0), 0);
    });

    Object.entries(summary).forEach(([key, value]) => {
      console.log(`   - ${key}: ${value.count} records, ${value.clearedQty} units cleared (from ${value.source || 'N/A'})`);
    });

    console.log('\n💡 Final State of Records:');
    console.log('   ✅ ID, Design, Color - KEPT');
    console.log('   ✅ Source Name & Type - KEPT');
    console.log('   ✅ Received Date - KEPT');
    console.log('   ✅ Batch ID & Notes - KEPT');
    console.log('   🔄 borrowStatus: "active" (changed from "returned")');
    console.log('   ❌ quantities: {} (cleared)');
    console.log('   ❌ totalQuantity: 0 (cleared)');
    console.log('   ❌ returnedDate: DELETED');
    console.log('   ❌ returnedQuantity: 0 (cleared)');

    // Verify by showing one updated record
    console.log('\n🔍 Verification - Sample Updated Record:');
    const sampleUpdated = await FactoryReceiving.findOne({ _id: returnedStock[0]._id });
    console.log('─'.repeat(80));
    console.log(JSON.stringify(sampleUpdated, null, 2));
    console.log('─'.repeat(80));

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    rl.close();

  } catch (error) {
    console.error('❌ Error:', error);
    rl.close();
    process.exit(1);
  }
}

clearReturnedQuantities();
