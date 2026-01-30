// middleware/checkSubscription.js
const Subscription = require('../models/Subscription');
const logger = require('../utils/logger');

// Middleware to check subscription status for order creation
const checkSubscription = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // Admin and sales users bypass subscription check
    if (['admin', 'sales'].includes(userRole) && !req.user.isTenant) {
      return next();
    }

    // Tenant users need active subscription
    const subscription = await Subscription.findOne({ userId });

    if (!subscription) {
      return res.status(402).json({
        success: false,
        code: 'NO_SUBSCRIPTION',
        message: 'Please subscribe to create orders',
        requiresAction: 'subscribe'
      });
    }

    // Check subscription status
    if (!['trial', 'active', 'grace-period'].includes(subscription.status)) {
      return res.status(402).json({
        success: false,
        code: 'SUBSCRIPTION_EXPIRED',
        message: 'Your subscription has expired. Please renew.',
        requiresAction: 'renew',
        data: {
          planType: subscription.planType,
          status: subscription.status
        }
      });
    }

    // Trial checks
    if (subscription.planType === 'trial') {
      if (subscription.trialOrdersUsed >= subscription.trialOrdersLimit) {
        return res.status(402).json({
          success: false,
          code: 'TRIAL_LIMIT_REACHED',
          message: `Trial limit of ${subscription.trialOrdersLimit} orders reached. Please upgrade.`,
          requiresAction: 'upgrade',
          data: {
            ordersUsed: subscription.trialOrdersUsed,
            ordersLimit: subscription.trialOrdersLimit
          }
        });
      }

      if (new Date() > subscription.trialEndDate) {
        return res.status(402).json({
          success: false,
          code: 'TRIAL_EXPIRED',
          message: 'Trial period expired. Please upgrade.',
          requiresAction: 'upgrade',
          data: {
            trialEndDate: subscription.trialEndDate
          }
        });
      }
    }

    // Yearly plan checks
    if (subscription.planType === 'yearly') {
      if (new Date() > subscription.yearlyEndDate) {
        if (subscription.status === 'grace-period') {
          // Allow but warn
          logger.warn('Order created during grace period', { userId });
        } else {
          return res.status(402).json({
            success: false,
            code: 'SUBSCRIPTION_EXPIRED',
            message: 'Yearly subscription expired. Please renew.',
            requiresAction: 'renew'
          });
        }
      }
    }

    // Order-based plan - no pre-check needed (charged per order)

    // Attach subscription to request for later use
    req.subscription = subscription;

    next();

  } catch (error) {
    logger.error('Subscription check failed', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to verify subscription',
      error: error.message
    });
  }
};

module.exports = checkSubscription;
