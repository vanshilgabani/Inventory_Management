const mongoose = require('mongoose');
const Product = require('../models/Product');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function quickFix() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const products = await Product.find({});
    
    console.log('🔧 Ensuring all currentStock values are valid...\n');
    
    let totalFixed = 0;
    
    for (const product of products) {
      let modified = false;
      
      for (const color of product.colors) {
        for (const size of color.sizes) {
          const currentStock = size.currentStock;
          
          if (currentStock === undefined || currentStock === null || isNaN(currentStock)) {
            console.log(`❌ ${product.design} - ${color.color} - ${size.size}: ${currentStock} → 0`);
            size.currentStock = 0;
            modified = true;
            totalFixed++;
          } else if (currentStock < 0) {
            console.log(`⚠️  ${product.design} - ${color.color} - ${size.size}: ${currentStock} → 0 (was negative)`);
            size.currentStock = 0;
            modified = true;
            totalFixed++;
          }
        }
      }
      
      if (modified) {
        await product.save();
      }
    }
    
    console.log('\n' + '='.repeat(60));
    if (totalFixed === 0) {
      console.log('✅ All products have valid currentStock!');
    } else {
      console.log(`✅ Fixed ${totalFixed} invalid currentStock values`);
    }
    console.log('='.repeat(60));
    
    await mongoose.disconnect();
    console.log('\n✅ Done!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

console.log('🚀 Fixing currentStock field...\n');
quickFix();
