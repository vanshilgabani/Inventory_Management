const Notification = require('../models/Notification');
const WholesaleOrder = require('../models/WholesaleOrder');
const WholesaleBuyer = require('../models/WholesaleBuyer');

// @desc Get all notifications
// @route GET /api/notifications
// @access Private
const getAllNotifications = async (req, res) => {
  try {
    const { status, severity, isTrusted, hasEmail } = req.query;
    
    const filter = {};
    
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    if (severity) {
      filter.severity = severity;
    }
    
    if (isTrusted !== undefined && isTrusted !== '') {
      filter.isTrusted = isTrusted === 'true';
    }
    
    if (hasEmail !== undefined && hasEmail !== '') {
      if (hasEmail === 'true') {
        filter.buyerEmail = { $exists: true, $ne: '' };
      } else {
        filter.$or = [
          { buyerEmail: { $exists: false } },
          { buyerEmail: '' }
        ];
      }
    }
    
    console.log('🔍 Filter being used:', filter);  // ADD THIS
    
    const notifications = await Notification.find(filter)
      .populate('buyerId', 'name mobile businessName email creditLimit totalDue')
      .populate('orderIds', 'challanNumber totalAmount amountPaid amountDue createdAt')
      .sort({ severity: -1, createdAt: -1 });
    
    console.log('🔍 Notifications found:', notifications.length);  // ADD THIS
    console.log('🔍 First notification:', notifications[0]);  // ADD THIS
    
    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Get notification count
// @route GET /api/notifications/count
// @access Private
const getNotificationCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ status: 'active' });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Get notification summary
// @route GET /api/notifications/summary
// @access Private
const getNotificationSummary = async (req, res) => {
  try {
    const critical = await Notification.countDocuments({ status: 'active', severity: 'critical' });
    const urgent = await Notification.countDocuments({ status: 'active', severity: 'urgent' });
    const moderate = await Notification.countDocuments({ status: 'active', severity: 'moderate' });
    const warning = await Notification.countDocuments({ status: 'active', severity: 'warning' });
    
    const criticalAmount = await Notification.aggregate([
      { $match: { status: 'active', severity: 'critical' } },
      { $group: { _id: null, total: { $sum: '$amountDue' } } }
    ]);
    
    const urgentAmount = await Notification.aggregate([
      { $match: { status: 'active', severity: 'urgent' } },
      { $group: { _id: null, total: { $sum: '$amountDue' } } }
    ]);
    
    const moderateAmount = await Notification.aggregate([
      { $match: { status: 'active', severity: 'moderate' } },
      { $group: { _id: null, total: { $sum: '$amountDue' } } }
    ]);
    
    const warningAmount = await Notification.aggregate([
      { $match: { status: 'active', severity: 'warning' } },
      { $group: { _id: null, total: { $sum: '$amountDue' } } }
    ]);
    
    const creditBlocked = await WholesaleBuyer.countDocuments({
      $expr: { $gte: ['$totalDue', '$creditLimit'] },
      creditLimit: { $gt: 0 }
    });
    
    res.json({
      critical: { count: critical, amount: criticalAmount[0]?.total || 0 },
      urgent: { count: urgent, amount: urgentAmount[0]?.total || 0 },
      moderate: { count: moderate, amount: moderateAmount[0]?.total || 0 },
      warning: { count: warning, amount: warningAmount[0]?.total || 0 },
      creditBlocked
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Dismiss notification
// @route POST /api/notifications/:id/dismiss
// @access Private
const dismissNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    notification.status = 'dismissed';
    notification.dismissedAt = new Date();
    await notification.save();
    
    res.json({ message: 'Notification dismissed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Snooze notification
// @route POST /api/notifications/:id/snooze
// @access Private
const snoozeNotification = async (req, res) => {
  try {
    const { days, reason } = req.body;
    
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    const snoozeDate = new Date();
    snoozeDate.setDate(snoozeDate.getDate() + days);
    
    notification.status = 'snoozed';
    notification.snoozedUntil = snoozeDate;
    
    notification.contactHistory.push({
      method: 'note',
      details: `Snoozed for ${days} days. Reason: ${reason || 'Not specified'}`,
      sentBy: req.user?.name || 'System'
    });
    
    await notification.save();
    
    res.json({ message: 'Notification snoozed', notification });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Resolve notification (mark as paid)
// @route POST /api/notifications/:id/resolve
// @access Private
const resolveNotification = async (req, res) => {
  try {
    const { paymentAmount, paymentMethod, notes } = req.body;
    
    const notification = await Notification.findById(req.params.id)
      .populate('orderIds');  // ✅ FIXED: orderIds (plural)
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    // Get the first order (for single order notifications) or handle multiple orders
    const order = notification.orderIds && notification.orderIds.length > 0 
      ? notification.orderIds[0] 
      : null;
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Validate payment amount
    if (paymentAmount > order.amountDue) {
      return res.status(400).json({ 
        message: `Payment amount cannot exceed due amount of ₹${order.amountDue}` 
      });
    }
    
    // Update order payment
    const newTotalPaid = order.amountPaid + paymentAmount;
    
    order.paymentHistory.push({
      amount: paymentAmount,
      paymentDate: new Date(),
      paymentMethod: paymentMethod || 'Cash',
      notes: notes || '',
      recordedBy: req.user?.name || 'System'
    });
    
    order.amountPaid = newTotalPaid;
    await order.save();
    
    // Update notification
    notification.contactHistory.push({
      method: 'note',
      details: `Payment received: ₹${paymentAmount} via ${paymentMethod}. ${notes || ''}`,
      sentBy: req.user?.name || 'System'
    });
    
    // If fully paid, resolve notification
    if (order.amountDue <= 0) {
      notification.status = 'resolved';
      notification.resolvedAt = new Date();
    } else {
      notification.amountDue = order.amountDue;
    }
    
    await notification.save();
    
    // Update buyer totals
    if (order.buyerId) {
      const buyer = await WholesaleBuyer.findById(order.buyerId);
      if (buyer) {
        const allOrders = await WholesaleOrder.find({ buyerId: buyer._id });
        buyer.totalDue = allOrders.reduce((sum, o) => sum + (o.amountDue || 0), 0);
        buyer.totalPaid = allOrders.reduce((sum, o) => sum + (o.amountPaid || 0), 0);
        await buyer.save();
      }
    }
    
    res.json({ 
      message: order.amountDue <= 0 ? 'Payment recorded and notification resolved' : 'Partial payment recorded',
      notification 
    });
  } catch (error) {
    console.error('Resolve notification error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Add contact note
// @route POST /api/notifications/:id/contact
// @access Private
const addContactNote = async (req, res) => {
  try {
    const { method, details, emailStatus } = req.body;
    
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    notification.contactHistory.push({
      method,
      details,
      sentBy: req.user?.name || 'System',
      emailStatus: emailStatus || 'delivered'
    });
    
    await notification.save();
    
    res.json({ message: 'Contact logged', notification });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Set payment promise
// @route POST /api/notifications/:id/promise
// @access Private
const setPaymentPromise = async (req, res) => {
  try {
    const { amount, promisedDate, notes, remindIfNotPaid } = req.body;
    
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    notification.paymentPromise = {
      amount,
      promisedDate,
      notes,
      remindIfNotPaid
    };
    
    notification.contactHistory.push({
      method: 'note',
      details: `Payment promise set: ₹${amount} by ${new Date(promisedDate).toLocaleDateString()}. ${notes || ''}`,
      sentBy: req.user?.name || 'System'
    });
    
    await notification.save();
    
    res.json({ message: 'Payment promise saved', notification });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Send single warning email
// @route POST /api/notifications/:id/send-email
// @access Private
const sendWarningEmail = async (req, res) => {
  try {
    const emailService = require('../utils/emailService');
    const notification = await Notification.findById(req.params.id).populate('buyerId');
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    if (!notification.buyerEmail) {
      return res.status(400).json({ message: 'Buyer has no email address' });
    }
    
    let result;
    
    // Send appropriate email based on notification type
    if (notification.type === 'credit_limit_80') {
      result = await emailService.sendCreditLimitWarning(
        notification.buyerEmail,
        notification.buyerName,
        notification.creditUsagePercent,
        notification.buyerId?.creditLimit || 0,
        notification.amountDue
      );
    } else if (notification.type === 'overdue_payment') {
      result = await emailService.sendOverduePaymentReminder(
        notification.buyerEmail,
        notification.buyerName,
        notification.amountDue,
        notification.daysOverdue || 0,
        notification.pendingOrdersCount || 0
      );
    } else {
      return res.status(400).json({ message: 'Invalid notification type for email' });
    }
    
    // Log result
    notification.contactHistory.push({
      method: 'email',
      details: result?.success ? 'Warning email sent' : `Email failed: ${result?.error || 'Unknown error'}`,
      sentBy: req.user?.name || 'System',
      emailStatus: result?.success ? 'delivered' : 'failed'
    });
    await notification.save();
    
    if (result?.success) {
      res.json({ message: 'Email sent successfully', notification });
    } else {
      res.status(500).json({ message: `Failed to send email: ${result?.error}` });
    }
  } catch (error) {
    console.error('❌ Send email error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc Send bulk emails
// @route POST /api/notifications/bulk-email
// @access Private
const sendBulkEmails = async (req, res) => {
  try {
    const { notificationIds } = req.body;
    const emailService = require('../utils/emailService');
    
    let successCount = 0;
    let failCount = 0;
    
    for (const id of notificationIds) {
      try {  // ✅ ADD TRY-CATCH FOR EACH EMAIL
        const notification = await Notification.findById(id).populate('buyerId');
        
        if (!notification) {
          console.log(`❌ Notification ${id} not found`);
          failCount++;
          continue;
        }
        
        if (!notification.buyerEmail) {
          console.log(`❌ No email for notification ${id}`);
          failCount++;
          continue;
        }
        
        let result;
        
        // Send appropriate email based on notification type
        if (notification.type === 'credit_limit_80') {
          result = await emailService.sendCreditLimitWarning(
            notification.buyerEmail,
            notification.buyerName,
            notification.creditUsagePercent,
            notification.buyerId?.creditLimit || 0,  // ✅ SAFE ACCESS
            notification.amountDue
          );
        } else if (notification.type === 'overdue_payment') {
          result = await emailService.sendOverduePaymentReminder(
            notification.buyerEmail,
            notification.buyerName,
            notification.amountDue,
            notification.daysOverdue || 0,
            notification.pendingOrdersCount || 0
          );
        } else {
          console.log(`⚠️ Unknown notification type: ${notification.type}`);
          failCount++;
          continue;
        }
        
        // Log result
        notification.contactHistory.push({
          method: 'email',
          details: result?.success ? 'Bulk reminder email sent' : `Email failed: ${result?.error || 'Unknown error'}`,
          sentBy: req.user?.name || 'System',
          emailStatus: result?.success ? 'delivered' : 'failed'
        });
        await notification.save();
        
        if (result?.success) {
          console.log(`✅ Email sent to ${notification.buyerEmail}`);
          successCount++;
        } else {
          console.log(`❌ Email failed for ${notification.buyerEmail}:`, result?.error);
          failCount++;
        }
      } catch (emailError) {
        console.error(`❌ Error sending email for notification ${id}:`, emailError);
        failCount++;
      }
    }
    
    res.json({ 
      message: `Emails sent: ${successCount} successful, ${failCount} failed`,
      success: successCount,
      failed: failCount
    });
  } catch (error) {
    console.error('❌ Bulk email error:', error);
    res.status(500).json({ message: error.message });
  }
};


// @desc Delete old resolved notifications
// @route DELETE /api/notifications/cleanup
// @access Private (Admin only)
const cleanupNotifications = async (req, res) => {
  try {
    const Settings = require('../models/Settings');
    const settings = await Settings.findOne();
    
    if (!settings?.notifications?.enableAutoDelete) {
      return res.json({ message: 'Auto-delete is disabled' });
    }
    
    const days = settings.notifications.autoDeleteResolvedAfterDays || 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const result = await Notification.deleteMany({
      status: { $in: ['resolved', 'dismissed'] },
      $or: [
        { resolvedAt: { $lt: cutoffDate } },
        { dismissedAt: { $lt: cutoffDate } }
      ]
    });
    
    res.json({ message: `Deleted ${result.deletedCount} old notifications` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllNotifications,
  getNotificationCount,
  getNotificationSummary,
  dismissNotification,
  snoozeNotification,
  resolveNotification,
  addContactNote,
  setPaymentPromise,
  sendWarningEmail,
  sendBulkEmails,
  cleanupNotifications
};
