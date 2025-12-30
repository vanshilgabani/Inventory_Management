const mongoose = require('mongoose');
const MarketplaceSale = require('../models/MarketplaceSale');
const Product = require('../models/Product');
const path = require('path');

// Load .env from the server root directory
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * Script to remove all "upcoming" orders and restore their stock
 * Run this once after deploying the new code
 */

async function removeUpcomingOrders() {
  try {
    // Check if MONGODB_URI exists
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!mongoUri) {
      console.error('❌ ERROR: MongoDB URI not found in environment variables');
      console.error('   Looking for: MONGODB_URI or MONGO_URI');
      console.error('   .env path:', path.join(__dirname, '../../.env'));
      console.error('   Please check your .env file');
      process.exit(1);
    }

    console.log('🔗 Connecting to MongoDB...');
    
    // Connect to MongoDB
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find all upcoming orders
      const upcomingOrders = await MarketplaceSale.find({ 
        status: 'upcoming' 
      }).session(session);

      console.log(`\n📦 Found ${upcomingOrders.length} upcoming orders to remove`);

      if (upcomingOrders.length === 0) {
        console.log('✅ No upcoming orders found. Nothing to do.');
        await session.abortTransaction();
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      // Process each order
      for (const order of upcomingOrders) {
        try {
          console.log(`\n📝 Processing: ${order.design} - ${order.color} - ${order.size} (Qty: ${order.quantity})`);
          console.log(`   Order ID: ${order._id}`);
          console.log(`   Account: ${order.accountName}`);
          console.log(`   Marketplace Order ID: ${order.marketplaceOrderId || 'N/A'}`);

          // Find the product
          const product = await Product.findOne({
            organizationId: order.organizationId,
            design: order.design,
            'colors.color': order.color
          }).session(session);

          if (!product) {
            console.log(`   ⚠️  WARNING: Product ${order.design} not found. Deleting order anyway.`);
            errorCount++;
            errors.push({
              orderId: order._id,
              reason: 'Product not found',
              order: order
            });
          } else {
            const colorVariant = product.colors.find(c => c.color === order.color);
            
            if (!colorVariant) {
              console.log(`   ⚠️  WARNING: Color ${order.color} not found. Deleting order anyway.`);
              errorCount++;
              errors.push({
                orderId: order._id,
                reason: 'Color not found',
                order: order
              });
            } else {
              const sizeVariant = colorVariant.sizes.find(s => s.size === order.size);
              
              if (!sizeVariant) {
                console.log(`   ⚠️  WARNING: Size ${order.size} not found. Deleting order anyway.`);
                errorCount++;
                errors.push({
                  orderId: order._id,
                  reason: 'Size not found',
                  order: order
                });
              } else {
                // Restore stock
                const oldStock = sizeVariant.quantity;
                sizeVariant.quantity += order.quantity;
                await product.save({ session });
                
                console.log(`   ✅ Stock restored: ${oldStock} → ${sizeVariant.quantity} (+${order.quantity})`);
                successCount++;
              }
            }
          }

          // Delete the order
          await MarketplaceSale.deleteOne({ _id: order._id }).session(session);
          console.log(`   🗑️  Order deleted`);

        } catch (err) {
          console.error(`   ❌ Error processing order ${order._id}:`, err.message);
          errorCount++;
          errors.push({
            orderId: order._id,
            reason: err.message,
            order: order
          });
        }
      }

      // Commit transaction
      await session.commitTransaction();
      console.log('\n' + '='.repeat(60));
      console.log('✅ MIGRATION COMPLETED SUCCESSFULLY');
      console.log('='.repeat(60));
      console.log(`📊 Summary:`);
      console.log(`   Total orders processed: ${upcomingOrders.length}`);
      console.log(`   Successfully restored stock: ${successCount}`);
      console.log(`   Warnings/Errors: ${errorCount}`);
      
      if (errors.length > 0) {
        console.log(`\n⚠️  Orders with issues (still deleted):`);
        errors.forEach(err => {
          console.log(`   - ${err.orderId}: ${err.reason}`);
        });
      }

      console.log('\n✅ All "upcoming" orders have been removed from the database.');
      console.log('✅ Stock has been restored where possible.');

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
console.log('🚀 Starting migration to remove "upcoming" orders...\n');
removeUpcomingOrders();
