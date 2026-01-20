const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const WholesaleBuyer = require('../server/src/models/WholesaleBuyer');
const MonthlyBill = require('../server/src/models/MonthlyBill');
const WholesaleOrder = require('../server/src/models/WholesaleOrder');

// GST Numbers
const OLD_GST = '24CHOPC0747F1ZL';
const NEW_GST = '24ALRPG9626Q1Z8';
const NEW_PAN = NEW_GST.substring(2, 12); // Extract PAN: ALRPG9626Q

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/your-db-name', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

// Main Migration Function
const migrateGSTNumber = async () => {
  console.log('\n🚀 Starting GST Number Migration...\n');
  console.log(`📝 Old GST: ${OLD_GST}`);
  console.log(`📝 New GST: ${NEW_GST}`);
  console.log(`📝 New PAN: ${NEW_PAN}\n`);

  try {
    // ============================================================================
    // STEP 1: UPDATE WHOLESALEBUYER COLLECTION
    // ============================================================================
    console.log('📦 Step 1: Updating WholesaleBuyer...');
    
    const buyer = await WholesaleBuyer.findOne({ gstNumber: OLD_GST });
    
    if (!buyer) {
      console.log(`⚠️  No buyer found with GST: ${OLD_GST}`);
      console.log('\n🔍 Searching for buyers with similar GST...');
      const allBuyers = await WholesaleBuyer.find().select('name mobile gstNumber');
      console.log('\nAll buyers GST numbers:');
      allBuyers.forEach(b => {
        console.log(`   - ${b.name} (${b.mobile}): ${b.gstNumber || 'No GST'}`);
      });
      return;
    }

    console.log(`   Found buyer: ${buyer.name} (${buyer.mobile})`);
    console.log(`   Buyer ID: ${buyer._id}`);
    
    // Update main GST number and PAN
    buyer.gstNumber = NEW_GST;
    buyer.pan = NEW_PAN;
    
    // Update GST profiles if exists
    if (buyer.gstProfiles && buyer.gstProfiles.length > 0) {
      let profilesUpdated = 0;
      buyer.gstProfiles.forEach(profile => {
        if (profile.gstNumber === OLD_GST) {
          profile.gstNumber = NEW_GST;
          profile.pan = NEW_PAN;
          profilesUpdated++;
          console.log(`   ✅ Updated GST profile: ${profile.profileId}`);
        }
      });
      if (profilesUpdated === 0) {
        console.log(`   ℹ️  No GST profiles matched old GST`);
      }
    } else {
      console.log(`   ℹ️  No GST profiles found for this buyer`);
    }
    
    await buyer.save();
    console.log(`   ✅ Buyer updated successfully\n`);

    // ============================================================================
    // STEP 2: UPDATE MONTHLYBILL COLLECTION
    // ============================================================================
    console.log('📄 Step 2: Updating MonthlyBills...');
    
    // First, check how many bills exist
    const billsCount = await MonthlyBill.countDocuments({ 'buyer.gstin': OLD_GST });
    console.log(`   Found ${billsCount} bills with old GST`);
    
    if (billsCount > 0) {
      const billsResult = await MonthlyBill.updateMany(
        { 'buyer.gstin': OLD_GST },
        { 
          $set: { 
            'buyer.gstin': NEW_GST,
            'buyer.pan': NEW_PAN
          }
        }
      );
      
      console.log(`   ✅ Updated ${billsResult.modifiedCount} bills\n`);
    } else {
      console.log(`   ℹ️  No bills found with old GST\n`);
    }

    // ============================================================================
    // STEP 3: CHECK WHOLESALEORDER COLLECTION
    // ============================================================================
    console.log('📋 Step 3: Checking WholesaleOrders...');
    
    const ordersCount = await WholesaleOrder.countDocuments({ 
      buyerId: buyer._id 
    });
    
    console.log(`   ℹ️  Found ${ordersCount} orders for this buyer`);
    console.log(`   ℹ️  Orders are linked via buyerId (no direct GST update needed)\n`);

    // ============================================================================
    // VERIFICATION
    // ============================================================================
    console.log('🔍 Verification:');
    
    const updatedBuyer = await WholesaleBuyer.findById(buyer._id);
    console.log(`   Buyer Name: ${updatedBuyer.name}`);
    console.log(`   Buyer GST: ${updatedBuyer.gstNumber}`);
    console.log(`   Buyer PAN: ${updatedBuyer.pan}`);
    
    const newBillsCount = await MonthlyBill.countDocuments({ 'buyer.gstin': NEW_GST });
    console.log(`   Bills with new GST: ${newBillsCount}`);
    
    const oldBillsCount = await MonthlyBill.countDocuments({ 'buyer.gstin': OLD_GST });
    console.log(`   Bills with old GST: ${oldBillsCount} (should be 0)`);
    
    // Check GST profiles
    if (updatedBuyer.gstProfiles && updatedBuyer.gstProfiles.length > 0) {
      console.log(`\n   GST Profiles:`);
      updatedBuyer.gstProfiles.forEach((profile, index) => {
        console.log(`     ${index + 1}. ${profile.profileId}: ${profile.gstNumber} (${profile.businessName})`);
      });
    }
    
    console.log('\n✅ Migration completed successfully!\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed\n');
  }
};

// Run Migration
const runMigration = async () => {
  await connectDB();
  await migrateGSTNumber();
  process.exit(0);
};

runMigration();
