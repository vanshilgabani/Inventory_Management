const mongoose = require('mongoose');
require('dotenv').config();

const migrateToSimplifiedSales = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    
    // Migrate MarketplaceSales
    console.log('🔄 Migrating marketplace sales...');
    const salesCollection = db.collection('marketplacesales');
    const oldSales = await salesCollection.find({}).toArray();
    
    console.log(`📦 Found ${oldSales.length} sales`);
    
    let migratedCount = 0;
    
    for (const sale of oldSales) {
      try {
        // Check if already migrated (new schema has 'accountName', old has 'marketplaceAccount' or 'marketplace')
        if (sale.accountName && !sale.marketplace && !sale.marketplaceAccount) {
          console.log(`⏭️  Sale ${sale._id} already in new format, skipping...`);
          continue;
        }
        
        // Build update object
        const updateData = {
          accountName: sale.marketplaceAccount || sale.marketplace || 'Unknown Account',
          design: sale.design,
          color: sale.color,
          size: sale.size,
          quantity: sale.quantity,
          saleDate: sale.orderDate || sale.saleDate || sale.createdAt,
          notes: sale.notes || '',
          productId: sale.productId || null,
          organizationId: sale.organizationId || null,
          updatedAt: new Date()
        };
        
        // Keep original timestamps if they exist
        if (sale.createdAt) {
          updateData.createdAt = sale.createdAt;
        }
        
        // Fields to remove (old schema)
        const unsetFields = {
          marketplace: '',
          marketplaceAccount: '',
          orderId: '',
          pricingData: '',
          totalSellingPrice: '',
          totalSettlement: '',
          totalCost: '',
          totalProfit: '',
          returnLoss: '',
          finalProfit: '',
          status: '',
          orderDate: ''
        };
        
        // Update the document
        await salesCollection.updateOne(
          { _id: sale._id },
          { 
            $set: updateData,
            $unset: unsetFields
          }
        );
        
        migratedCount++;
        console.log(`✅ Migrated sale ${sale._id} - ${sale.design}`);
        
      } catch (error) {
        console.error(`❌ Failed to migrate sale ${sale._id}:`, error.message);
      }
    }
    
    console.log(`\n✅ Sales migration complete!`);
    console.log(`   Total: ${oldSales.length}`);
    console.log(`   Migrated: ${migratedCount}`);
    console.log(`   Already migrated: ${oldSales.length - migratedCount}`);
    
    console.log('\n✅ All migrations completed successfully!');
    await mongoose.connection.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

migrateToSimplifiedSales();
