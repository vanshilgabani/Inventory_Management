const mongoose = require('mongoose');
const Product = require('../models/Product');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function verifyInventory() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const products = await Product.find({});
    
    console.log('📦 Checking inventory for undefined or NaN quantities...\n');
    
    let issuesFound = 0;
    
    for (const product of products) {
      for (const color of product.colors) {
        for (const size of color.sizes) {
          if (size.quantity === undefined || isNaN(size.quantity) || size.quantity === null) {
            console.log(`⚠️  ISSUE FOUND:`);
            console.log(`   Product: ${product.design}`);
            console.log(`   Color: ${color.color}`);
            console.log(`   Size: ${size.size}`);
            console.log(`   Current Quantity: ${size.quantity}`);
            console.log(`   → Setting to 0\n`);
            
            size.quantity = 0;
            issuesFound++;
          }
        }
      }
      
      if (issuesFound > 0) {
        await product.save();
      }
    }
    
    if (issuesFound === 0) {
      console.log('✅ No issues found! All inventory quantities are valid.');
    } else {
      console.log(`✅ Fixed ${issuesFound} invalid quantities (set to 0).`);
      console.log('⚠️  Please manually verify these products in your inventory.');
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Done!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyInventory();
