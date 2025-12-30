const cron = require('node-cron');
const MarketplaceSale = require('../models/MarketplaceSale');
const Product = require('../models/Product');
const logger = require('./logger');

const initCronJobs = () => {
  // Run daily at 3:00 PM IST
  cron.schedule('0 15 * * *', async () => {
    //cron.schedule('* * * * *', async () => {
    console.log('🔄 Running Flipkart Auto-Dispatch Job...');
    
    try {
      // 1. Find all 'upcoming' orders for Flipkart accounts
      const upcomingOrders = await MarketplaceSale.find({
        status: 'upcoming',
        accountName: { $regex: /flipkart/i }
      });

      if (upcomingOrders.length === 0) {
        console.log('✅ No pending Flipkart orders to process.');
        return;
      } // ✅ FIXED: Added missing closing brace

      console.log(`📋 Found ${upcomingOrders.length} upcoming Flipkart orders. Checking dates...`);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let dispatchedCount = 0;

      for (const order of upcomingOrders) {
        try {
          const saleDate = new Date(order.saleDate);
          saleDate.setHours(0, 0, 0, 0);

          // 2. Calculate Due Date logic
          let daysToAdd = 2;
          const dayOfWeek = saleDate.getDay();
          
          // If Friday (5) or Saturday (6), add 3 days to skip Sunday
          if (dayOfWeek === 5 || dayOfWeek === 6) {
            daysToAdd = 3;
          }

          const dueDate = new Date(saleDate);
          dueDate.setDate(dueDate.getDate() + daysToAdd);

          // 3. Check if Today is the Due Date (or after)
          if (today >= dueDate) {
            order.status = 'dispatched';
            
            // ✅ FIXED: Proper structure with null userId
            order.statusHistory.push({
              previousStatus: 'upcoming',
              newStatus: 'dispatched',
              changedBy: {
                userId: null,  // ✅ Now allowed by schema
                userName: 'System (Flipkart Auto)',
                userRole: 'system'
              },
              changedAt: new Date(),
              comments: `Auto-dispatched at 4:00 PM (${daysToAdd === 2 ? '48' : '72'}hr rule)`
            });

            await order.save();
            dispatchedCount++;
            logger.info(`🤖 Auto-dispatched Flipkart Order: ${order._id} | Sale Date: ${saleDate.toDateString()} | Due Date: ${dueDate.toDateString()}`);
          }
        } catch (orderError) {
          console.error(`❌ Error processing order ${order._id}:`, orderError.message);
          logger.error(`Failed to process order ${order._id}`, orderError);
          // Continue with next order
        }
      }

      console.log(`✅ Job Complete. Auto-dispatched ${dispatchedCount} / ${upcomingOrders.length} orders.`);
      logger.info(`Flipkart Auto-Dispatch completed: ${dispatchedCount} orders dispatched`);
      
    } catch (error) {
      console.error('❌ Error in Flipkart Auto-Dispatch Job:', error);
      logger.error('Cron Job Failed', error);
    }
  }, {
    timezone: "Asia/Kolkata"  // ✅ Force IST timezone
  });

  console.log('✅ Cron Jobs initialized: Flipkart Auto-Dispatch scheduled for 4:00 PM IST daily');
};

module.exports = initCronJobs;
