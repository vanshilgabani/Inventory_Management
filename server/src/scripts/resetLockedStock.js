const mongoose = require('mongoose');
const Product = require('../models/Product');

// Connect to your database
mongoose.connect('mongodb+srv://vanshilgabani:dharmajivanv1@inventorymanagement.4bk0m5j.mongodb.net/InventoryManagement?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const resetLockedStock = async () => {
  try {
    console.log('🔄 Starting locked stock reset...');
    
    const result = await Product.updateMany(
      {},
      {
        $set: {
          "colors.$[].sizes.$[].lockedStock": 0
        }
      }
    );

    console.log('✅ Reset complete!');
    console.log(`📊 Updated ${result.modifiedCount} products`);
    
    // Verify
    const products = await Product.find({});
    let totalVariants = 0;
    let nonZeroCount = 0;
    
    products.forEach(product => {
      product.colors.forEach(color => {
        color.sizes.forEach(size => {
          totalVariants++;
          if (size.lockedStock && size.lockedStock > 0) {
            nonZeroCount++;
          }
        });
      });
    });
    
    console.log(`✅ Total variants checked: ${totalVariants}`);
    console.log(`✅ Non-zero locked stock: ${nonZeroCount}`);
    
    mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

resetLockedStock();
