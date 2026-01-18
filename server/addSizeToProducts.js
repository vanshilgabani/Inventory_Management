/**
 * Migration Script: Add "S" size to all existing products
 * 
 * Purpose: When a new size is enabled in settings, this script adds it to all products
 * 
 * Usage:
 *   node migrations/addSizeToProducts.js
 * 
 * Or with specific size:
 *   node migrations/addSizeToProducts.js XXL
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Product = require('../server/src/models/Product');
const Settings = require('../server/src/models/Settings');

// ============================================
// CONFIGURATION
// ============================================
const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/your-db-name';
const SIZE_TO_ADD = process.argv[2] || 'S'; // Default: S, or pass as argument

// ============================================
// MAIN MIGRATION FUNCTION
// ============================================
async function migrateAddSize() {
  try {
    console.log('🚀 Starting migration: Add size to products');
    console.log('📊 Target size:', SIZE_TO_ADD);
    console.log('🔗 Connecting to MongoDB...');

    // Connect to database
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB');

    // Get all organizations
    const settings = await Settings.find({});
    console.log(`🏢 Found ${settings.length} organizations`);

    let totalProductsUpdated = 0;
    let totalSizesAdded = 0;

    for (const orgSettings of settings) {
      const organizationId = orgSettings.organizationId;
      console.log(`\n📦 Processing organization: ${organizationId}`);

      // Check if size is enabled for this organization
      if (!orgSettings.enabledSizes || !orgSettings.enabledSizes.includes(SIZE_TO_ADD)) {
        console.log(`  ⚠️ Size "${SIZE_TO_ADD}" not enabled in settings, skipping...`);
        continue;
      }

      // Get all products for this organization
      const products = await Product.find({ organizationId });
      console.log(`  📦 Found ${products.length} products`);

      let orgProductsUpdated = 0;
      let orgSizesAdded = 0;

      for (const product of products) {
        let productModified = false;

        for (const colorVariant of product.colors) {
          const existingSizes = colorVariant.sizes.map(s => s.size);

          // Check if size already exists
          if (existingSizes.includes(SIZE_TO_ADD)) {
            continue; // Size already exists, skip
          }

          // Add the missing size
          console.log(`    ➕ Adding "${SIZE_TO_ADD}" to ${product.design} - ${colorVariant.color}`);
          
          colorVariant.sizes.push({
            size: SIZE_TO_ADD,
            currentStock: 0,
            reservedStock: 0,
            lockedStock: 0
          });

          productModified = true;
          orgSizesAdded++;
        }

        // Save product if modified
        if (productModified) {
          await product.save();
          orgProductsUpdated++;
        }
      }

      console.log(`  ✅ Organization summary: ${orgProductsUpdated} products updated, ${orgSizesAdded} sizes added`);
      totalProductsUpdated += orgProductsUpdated;
      totalSizesAdded += orgSizesAdded;
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log(`📊 Total products updated: ${totalProductsUpdated}`);
    console.log(`📊 Total sizes added: ${totalSizesAdded}`);
    console.log(`🎯 Size added: "${SIZE_TO_ADD}"`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED');
    console.error('Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

// ============================================
// RUN MIGRATION
// ============================================
migrateAddSize();
