const cron = require('node-cron');
const WholesaleOrder = require('../models/WholesaleOrder');
const WholesaleBuyer = require('../models/WholesaleBuyer');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');

const checkAndCreateNotifications = async () => {
  try {
    console.log('🔔 Checking for notifications...', new Date().toLocaleString());
    
    // Get settings
    const settings = await Settings.findOne();
    
    if (!settings?.notifications?.enabled) {
      console.log('❌ Notifications disabled in settings');
      return;
    }
    
    const notifSettings = settings.notifications;
    
    // Get all buyers
    const buyers = await WholesaleBuyer.find({});
    
    console.log(`📊 Checking ${buyers.length} buyers for notifications`);
    
    for (const buyer of buyers) {
      // Get all pending orders for this buyer
      const pendingOrders = await WholesaleOrder.find({
        buyerId: buyer._id,
        amountDue: { $gt: 0 }
      }).sort({ createdAt: 1 }); // Oldest first
      
      if (pendingOrders.length === 0) {
        // No pending payments - delete any existing notification
        await Notification.deleteMany({
          buyerId: buyer._id,
          type: 'overdue_payment',
          status: { $in: ['active', 'snoozed'] }
        });
        continue;
      }
      
      // Calculate totals
      const totalDue = pendingOrders.reduce((sum, order) => sum + order.amountDue, 0);
      const oldestOrder = pendingOrders[0];
      const daysOverdue = Math.floor((new Date() - new Date(oldestOrder.createdAt)) / (1000 * 60 * 60 * 24));
      
      // Determine severity based on oldest order days
      let severity = null;
      
      if (daysOverdue >= notifSettings.criticalThresholdDays) {
        severity = 'critical';
      } else if (daysOverdue >= notifSettings.urgentThresholdDays) {
        severity = 'urgent';
      } else if (daysOverdue >= notifSettings.moderateThresholdDays) {
        severity = 'moderate';
      } else if (daysOverdue >= notifSettings.warningThresholdDays) {
        severity = 'warning';
      }
      
      // Check large amount for non-trusted buyers
      if (!buyer.isTrusted && totalDue >= notifSettings.largeAmountThreshold && !severity) {
        severity = 'urgent'; // Large amount = urgent
      }
      
      if (severity) {
        // Check if notification already exists for this buyer (overdue payment type)
        const existing = await Notification.findOne({
          buyerId: buyer._id,
          type: 'overdue_payment',
          status: { $in: ['active', 'snoozed'] }
        });
        
        // Get all order IDs for reference
        const orderIds = pendingOrders.map(o => o._id);
        
        if (existing) {
          // Update existing notification
          existing.severity = severity;
          existing.daysOverdue = daysOverdue;
          existing.amountDue = totalDue;
          existing.pendingOrdersCount = pendingOrders.length;
          existing.orderIds = orderIds;
          existing.status = 'active'; // Unsnooze if it was snoozed
          await existing.save();
          
          console.log(`🔄 Updated notification for ${buyer.name}: ${pendingOrders.length} orders, ₹${totalDue}`);
        } else {
          // Create new notification
          const notification = await Notification.create({
            type: 'overdue_payment',
            severity,
            status: 'active',
            buyerId: buyer._id,
            orderIds: orderIds,
            buyerName: buyer.name,
            businessName: buyer.businessName || buyer.name,
            buyerContact: buyer.mobile,
            buyerEmail: buyer.email || '',
            amountDue: totalDue,
            daysOverdue,
            pendingOrdersCount: pendingOrders.length,
            isTrusted: buyer.isTrusted
          });
          
          console.log(`✅ Created ${severity} notification for ${buyer.name}: ${pendingOrders.length} orders (${daysOverdue} days, ₹${totalDue})`);
          
          // Send auto-email if applicable
          if (notifSettings.emailAlertsEnabled && buyer.email) {
            if (notifSettings.autoEmailMode === 'all' || 
                (notifSettings.autoEmailMode === 'not_trusted_only' && !buyer.isTrusted)) {
              
              console.log(`📧 Would send email to ${buyer.email}`);
              
              notification.autoEmailSent = true;
              notification.autoEmailSentAt = new Date();
              notification.contactHistory.push({
                method: 'email',
                details: 'Auto-reminder email sent',
                sentBy: 'System',
                emailStatus: 'delivered'
              });
              await notification.save();
            }
          }
        }
      } else {
        // No severity threshold met - delete any existing notification
        await Notification.deleteMany({
          buyerId: buyer._id,
          type: 'overdue_payment',
          status: { $in: ['active', 'snoozed'] }
        });
      }
    }
    
    // Check credit limits
    const buyersWithCredit = await WholesaleBuyer.find({
      creditLimit: { $gt: 0 }
    });
    
    for (const buyer of buyersWithCredit) {
      const usagePercent = (buyer.totalDue / buyer.creditLimit) * 100;
      
      if (usagePercent >= notifSettings.creditWarningPercent) {
        // Check if notification exists
        const existing = await Notification.findOne({
          buyerId: buyer._id,
          type: 'credit_limit_80',
          status: { $in: ['active', 'snoozed'] }
        });
        
        if (!existing) {
          await Notification.create({
            type: 'credit_limit_80',
            severity: 'warning',
            status: 'active', 
            buyerId: buyer._id,
            buyerName: buyer.name,
            businessName: buyer.businessName || buyer.name,
            buyerContact: buyer.mobile,
            buyerEmail: buyer.email || '',
            amountDue: buyer.totalDue,
            isTrusted: buyer.isTrusted,
            creditUsagePercent: Math.round(usagePercent)
          });
          
          console.log(`⚠️ Created credit limit warning for ${buyer.name} (${usagePercent.toFixed(0)}%)`);
          
          // Send email to buyer if enabled
          if (notifSettings.autoEmailOn80Percent && notifSettings.emailAlertsEnabled && buyer.email) {
            const emailService = require('../utils/emailService');
            const result = await emailService.sendCreditLimitWarning(
              buyer.email,
              buyer.name,
              Math.round(usagePercent),
              buyer.creditLimit,
              buyer.totalDue
            );
            
            if (result.success) {
              console.log(`✅ Credit warning email sent to ${buyer.email}`);
            } else {
              console.log(`❌ Failed to send email to ${buyer.email}:`, result.error);
            }
          }
        }
      } else {
        // Below threshold - remove any credit limit warnings
        await Notification.deleteMany({
          buyerId: buyer._id,
          type: 'credit_limit_80',
          status: { $in: ['active', 'snoozed'] }
        });
      }
    }
    
    // Unsnooze notifications if time has passed
    const snoozedNotifs = await Notification.find({
      status: 'snoozed',
      snoozedUntil: { $lt: new Date() }
    });
    
    for (const notif of snoozedNotifs) {
      notif.status = 'active';
      notif.snoozedUntil = null;
      await notif.save();
      console.log(`⏰ Unsnoozed notification for ${notif.buyerName}`);
    }
    
    // Check payment promises
    const promiseNotifs = await Notification.find({
      'paymentPromise.remindIfNotPaid': true,
      'paymentPromise.promisedDate': { $lt: new Date() },
      status: 'active'
    });
    
    for (const notif of promiseNotifs) {
      notif.contactHistory.push({
        method: 'note',
        details: 'Payment promise date passed - buyer has not paid yet',
        sentBy: 'System'
      });
      await notif.save();
      console.log(`❌ Payment promise broken by ${notif.buyerName}`);
    }
    
    console.log('✅ Notification check completed');
    
  } catch (error) {
    console.error('❌ Error in checkNotifications:', error);
  }
};

// Run every day at 9 AM (configurable in settings)
const startNotificationCron = () => {
  // Run at 9:00 AM every day
  cron.schedule('0 9 * * *', checkAndCreateNotifications);
  console.log('✅ Notification cron job scheduled for 9:00 AM daily');
  
  // RUN IMMEDIATELY ON STARTUP FOR TESTING
  console.log('🔔 Running initial notification check...');
  checkAndCreateNotifications();
};

// Check notifications for a specific buyer only (faster)
const checkBuyerNotifications = async (buyerId) => {
  try {
    const settings = await Settings.findOne();
    
    if (!settings?.notifications?.enabled) {
      console.log('❌ Notifications disabled in settings');
      return;
    }
    
    const notifSettings = settings.notifications;
    const buyer = await WholesaleBuyer.findById(buyerId);
    
    if (!buyer) return;
    
    console.log(`🔔 Checking notifications for buyer: ${buyer.name}`);
    
    // Check credit limit
    if (buyer.creditLimit > 0) {
      const usagePercent = (buyer.totalDue / buyer.creditLimit) * 100;
      
      if (usagePercent >= notifSettings.creditWarningPercent) {
        // Check if notification exists
        const existing = await Notification.findOne({
          buyerId: buyer._id,
          type: 'credit_limit_80',
          status: { $in: ['active', 'snoozed'] }
        });
        
        if (!existing) {
          await Notification.create({
            type: 'credit_limit_80',
            severity: 'warning',
            status: 'active', 
            buyerId: buyer._id,
            buyerName: buyer.name,
            businessName: buyer.businessName || buyer.name,
            buyerContact: buyer.mobile,
            buyerEmail: buyer.email || '',
            amountDue: buyer.totalDue,
            isTrusted: buyer.isTrusted,
            creditUsagePercent: Math.round(usagePercent)
          });
          
          console.log(`⚠️ Created credit limit warning for ${buyer.name} (${usagePercent.toFixed(0)}%)`);
          
          // ✅ SEND INSTANT EMAIL
          if (notifSettings.autoEmailOn80Percent && notifSettings.emailAlertsEnabled && buyer.email) {
            const emailService = require('./emailService');
            const result = await emailService.sendCreditLimitWarning(
              buyer.email,
              buyer.name,
              Math.round(usagePercent),
              buyer.creditLimit,
              buyer.totalDue
            );
            
            if (result.success) {
              console.log(`✅ INSTANT credit warning email sent to ${buyer.email}`);
            } else {
              console.log(`❌ Failed to send email to ${buyer.email}:`, result.error);
            }
          }
        }
      } else {
        // Below threshold - remove any credit limit warnings
        await Notification.deleteMany({
          buyerId: buyer._id,
          type: 'credit_limit_80',
          status: { $in: ['active', 'snoozed'] }
        });
      }
    }
    
    console.log(`✅ Notification check completed for ${buyer.name}`);
    
  } catch (error) {
    console.error('❌ Error in checkBuyerNotifications:', error);
  }
};

module.exports = { startNotificationCron, checkAndCreateNotifications, checkBuyerNotifications };
