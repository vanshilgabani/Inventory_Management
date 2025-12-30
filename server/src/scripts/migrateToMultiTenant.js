const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const WholesaleOrder = require('../models/WholesaleOrder');
const WholesaleBuyer = require('../models/WholesaleBuyer');
const DirectSale = require('../models/DirectSale');
const FactoryReceiving = require('../models/FactoryReceiving');
const Settings = require('../models/Settings');

const migrateToMultiTenant = async () => {
  try {
    console.log('🚀 Starting multi-tenant migration...\n');

    // Step 1: Find the first admin user (your account)
    const adminUser = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 });
    
    if (!adminUser) {
      console.log('❌ No admin user found. Please create an admin user first.');
      return;
    }

    console.log(`✅ Found admin user: ${adminUser.name} (${adminUser.email})`);
    console.log(`   User ID: ${adminUser._id}\n`);

    // Step 2: Update admin user's organizationId to their own _id
    if (!adminUser.organizationId) {
      adminUser.organizationId = adminUser._id;
      await adminUser.save();
      console.log(`✅ Updated admin user organizationId\n`);
    }

    const orgId = adminUser._id;

    // Step 3: Update all users created by this admin
    const usersUpdated = await User.updateMany(
      { 
        organizationId: null,
        _id: { $ne: adminUser._id }
      },
      { 
        $set: { organizationId: orgId } 
      }
    );
    console.log(`✅ Updated ${usersUpdated.modifiedCount} user(s)\n`);

    // Step 4: Update Products
    const productsUpdated = await Product.updateMany(
      { organizationId: null },
      { $set: { organizationId: orgId } }
    );
    console.log(`✅ Updated ${productsUpdated.modifiedCount} product(s)`);

    // Step 5: Update WholesaleOrders
    const ordersUpdated = await WholesaleOrder.updateMany(
      { organizationId: null },
      { $set: { organizationId: orgId } }
    );
    console.log(`✅ Updated ${ordersUpdated.modifiedCount} wholesale order(s)`);

    // Step 6: Update WholesaleBuyers
    const buyersUpdated = await WholesaleBuyer.updateMany(
      { organizationId: null },
      { $set: { organizationId: orgId } }
    );
    console.log(`✅ Updated ${buyersUpdated.modifiedCount} wholesale buyer(s)`);

    // Step 7: Update DirectSales
    const salesUpdated = await DirectSale.updateMany(
      { organizationId: null },
      { $set: { organizationId: orgId } }
    );
    console.log(`✅ Updated ${salesUpdated.modifiedCount} direct sale(s)`);

    // Step 8: Update FactoryReceivings
    const receivingsUpdated = await FactoryReceiving.updateMany(
      { organizationId: null },
      { $set: { organizationId: orgId } }
    );
    console.log(`✅ Updated ${receivingsUpdated.modifiedCount} factory receiving(s)`);

    // Step 9: Update Settings
    const settingsUpdated = await Settings.updateMany(
      { organizationId: null },
      { $set: { organizationId: orgId } }
    );
    console.log(`✅ Updated ${settingsUpdated.modifiedCount} setting(s)`);

    console.log('\n🎉 Migration completed successfully!');
    console.log(`   All existing data has been assigned to organization: ${adminUser.name}\n`);

    // Summary
    console.log('📊 MIGRATION SUMMARY:');
    console.log(`   Admin User: ${adminUser.name} (${adminUser.email})`);
    console.log(`   Organization ID: ${orgId}`);
    console.log(`   Users: ${usersUpdated.modifiedCount}`);
    console.log(`   Products: ${productsUpdated.modifiedCount}`);
    console.log(`   Wholesale Orders: ${ordersUpdated.modifiedCount}`);
    console.log(`   Wholesale Buyers: ${buyersUpdated.modifiedCount}`);
    console.log(`   Direct Sales: ${salesUpdated.modifiedCount}`);
    console.log(`   Factory Receivings: ${receivingsUpdated.modifiedCount}`);
    console.log(`   Settings: ${settingsUpdated.modifiedCount}`);
    console.log('\n✅ Your data is safe and ready for multi-tenant mode!\n');

  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  }
};

module.exports = { migrateToMultiTenant };
