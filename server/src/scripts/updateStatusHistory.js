const mongoose = require('mongoose');
const MarketplaceSale = require('../models/MarketplaceSale');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * Script to update all statusHistory entries that contain 'upcoming'
 * Changes 'upcoming' to 'dispatched' in both previousStatus and newStatus
 */

async function updateStatusHistory() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find all sales with 'upcoming' in statusHistory
    const salesWithUpcoming = await MarketplaceSale.find({
      $or: [
        { 'statusHistory.previousStatus': 'upcoming' },
        { 'statusHistory.newStatus': 'upcoming' }
      ]
    });

    console.log(`📦 Found ${salesWithUpcoming.length} orders with 'upcoming' in status history\n`);

    if (salesWithUpcoming.length === 0) {
      console.log('✅ No orders need updating!');
      await mongoose.disconnect();
      process.exit(0);
    }

    let updatedCount = 0;

    for (const sale of salesWithUpcoming) {
      let modified = false;

      // Update each statusHistory entry
      sale.statusHistory.forEach(history => {
        if (history.previousStatus === 'upcoming') {
          console.log(`  Updating previousStatus: 'upcoming' → 'dispatched' for order ${sale._id}`);
          history.previousStatus = 'dispatched';
          modified = true;
        }
        if (history.newStatus === 'upcoming') {
          console.log(`  Updating newStatus: 'upcoming' → 'dispatched' for order ${sale._id}`);
          history.newStatus = 'dispatched';
          modified = true;
        }
      });

      // Also update the main status if it's still 'upcoming'
      if (sale.status === 'upcoming') {
        console.log(`  Updating main status: 'upcoming' → 'dispatched' for order ${sale._id}`);
        sale.status = 'dispatched';
        modified = true;
      }

      if (modified) {
        // Save with validation disabled temporarily
        await sale.save({ validateBeforeSave: false });
        updatedCount++;
        console.log(`✅ Updated order ${sale._id} (${sale.design} - ${sale.color} - ${sale.size})\n`);
      }
    }

    console.log('='.repeat(60));
    console.log('✅ MIGRATION COMPLETED');
    console.log('='.repeat(60));
    console.log(`📊 Total orders updated: ${updatedCount}`);
    console.log('\n✅ All status history entries have been updated.');
    console.log('✅ All "upcoming" references have been changed to "dispatched".');

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

console.log('🚀 Starting status history migration...\n');
updateStatusHistory();
