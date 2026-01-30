// server/src/scripts/fixTenantIds.js
const mongoose = require('mongoose');
require('dotenv').config();

const fixMissingTenantIds = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get the raw collection (bypass Mongoose validation)
    const salesCollection = mongoose.connection.collection('marketplacesales');

    // Step 1: Fix wrong_return to wrongreturn in status field
    console.log('\n📝 Step 1: Fixing wrong_return → wrongreturn in status field...');
    const statusResult = await salesCollection.updateMany(
      { status: 'wrong_return' },
      { $set: { status: 'wrongreturn' } }
    );
    console.log(`   Fixed ${statusResult.modifiedCount} sales with wrong_return status`);

    // Step 2: Fix wrong_return to wrongreturn in statusHistory
    console.log('\n📝 Step 2: Fixing wrong_return → wrongreturn in statusHistory...');
    const historyResult = await salesCollection.updateMany(
      { 
        $or: [
          { 'statusHistory.previousStatus': 'wrong_return' },
          { 'statusHistory.newStatus': 'wrong_return' }
        ]
      },
      { 
        $set: { 
          'statusHistory.$[elem1].previousStatus': 'wrongreturn',
          'statusHistory.$[elem2].newStatus': 'wrongreturn'
        }
      },
      {
        arrayFilters: [
          { 'elem1.previousStatus': 'wrong_return' },
          { 'elem2.newStatus': 'wrong_return' }
        ]
      }
    );
    console.log(`   Updated ${historyResult.modifiedCount} statusHistory entries`);

    // Step 3: Add missing tenantId (set it equal to organizationId)
    console.log('\n📝 Step 3: Adding missing tenantId fields...');
    const tenantIdResult = await salesCollection.updateMany(
      { tenantId: { $exists: false } },
      [{ $set: { tenantId: '$organizationId' } }]
    );
    console.log(`   Added tenantId to ${tenantIdResult.modifiedCount} sales`);

    // Step 4: Verify fixes
    console.log('\n📊 Verification:');
    const wrongReturnCount = await salesCollection.countDocuments({ status: 'wrong_return' });
    const missingTenantIdCount = await salesCollection.countDocuments({ tenantId: { $exists: false } });
    
    console.log(`   - Sales with wrong_return: ${wrongReturnCount} (should be 0)`);
    console.log(`   - Sales missing tenantId: ${missingTenantIdCount} (should be 0)`);

    if (wrongReturnCount === 0 && missingTenantIdCount === 0) {
      console.log('\n✅ All fixes applied successfully!');
    } else {
      console.log('\n⚠️  Some issues remain. Please check manually.');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
};

fixMissingTenantIds();
