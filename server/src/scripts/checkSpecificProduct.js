const mongoose = require('mongoose');
const Product = require('../models/Product');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function checkProduct() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    
    console.log('Checking D10 - Dark Grey - XXL...\n');
    
    const product = await Product.findOne({ design: 'D10' });
    
    if (!product) {
      console.log('❌ Product D10 not found');
      await mongoose.disconnect();
      process.exit(0);
    }
    
    const darkGrey = product.colors.find(c => c.color === 'Dark Grey');
    
    if (!darkGrey) {
      console.log('❌ Dark Grey color not found');
      await mongoose.disconnect();
      process.exit(0);
    }
    
    const xxl = darkGrey.sizes.find(s => s.size === 'XXL');
    
    if (!xxl) {
      console.log('❌ XXL size not found');
      await mongoose.disconnect();
      process.exit(0);
    }
    
    console.log('✅ Found:');
    console.log(`   Design: ${product.design}`);
    console.log(`   Color: ${darkGrey.color}`);
    console.log(`   Size: ${xxl.size}`);
    console.log(`   Quantity in DB: ${xxl.quantity}`);
    console.log(`   Type: ${typeof xxl.quantity}`);
    console.log(`   Is undefined: ${xxl.quantity === undefined}`);
    console.log(`   Is null: ${xxl.quantity === null}`);
    console.log(`   Is NaN: ${isNaN(xxl.quantity)}`);
    
    // Fix it
    console.log('\n🔧 Setting quantity to 1...');
    xxl.quantity = 1;
    await product.save();
    console.log('✅ Updated successfully!');
    
    await mongoose.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkProduct();
