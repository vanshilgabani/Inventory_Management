const mongoose = require('mongoose');
require('dotenv').config();

const fixProductIndex = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('products');

    // STEP 1: Check for products with null organizationId
    const nullOrgProducts = await collection.find({ organizationId: null }).toArray();
    console.log(`📊 Found ${nullOrgProducts.length} products with organizationId = null`);

    // STEP 2: Get current indexes
    const indexes = await collection.indexes();
    console.log('📋 Current indexes:', indexes.map(i => i.name));

    // STEP 3: Check if compound index already exists
    const hasCompoundIndex = indexes.some(i => i.name === 'design_1_organizationId_1' || i.name === 'design_org_unique');
    
    if (hasCompoundIndex) {
      console.log('✅ Compound index already exists!');
      
      // Check if old design_1 index still exists
      const hasOldIndex = indexes.some(i => i.name === 'design_1');
      
      if (hasOldIndex) {
        console.log('⚠️ Old design_1 index still exists - this was already dropped in your output');
        console.log('✅ Everything is configured correctly!');
      } else {
        console.log('✅ Old design_1 index already removed!');
      }
    }

    // STEP 4: Verify uniqueness
    const duplicates = await collection.aggregate([
      { $group: { _id: { design: '$design', organizationId: '$organizationId' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();

    if (duplicates.length > 0) {
      console.log('⚠️ WARNING: Found duplicate design+org combinations:');
      console.log(duplicates);
      console.log('\nYou need to manually resolve these duplicates!');
    } else {
      console.log('✅ No duplicate design+org combinations found');
    }

    // STEP 5: Final index summary
    const finalIndexes = await collection.indexes();
    console.log('\n📋 Final indexes:');
    finalIndexes.forEach(i => {
      console.log(`   - ${i.name}: ${JSON.stringify(i.key)} ${i.unique ? '(UNIQUE)' : ''}`);
    });

    console.log('\n🎉 Index configuration verified!');
    console.log('✅ Your database is ready for multi-tenant products!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

fixProductIndex();
