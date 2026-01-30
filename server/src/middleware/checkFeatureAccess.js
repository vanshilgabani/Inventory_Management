// middleware/checkFeatureAccess.js
const TenantSettings = require('../models/TenantSettings');
const Subscription = require('../models/Subscription');
const logger = require('../utils/logger');

// Middleware to check if user has access to a specific feature/module
const checkFeatureAccess = (requiredModule) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;

      // Admin and sales users have full access
      if (['admin', 'sales'].includes(userRole)) {
        return next();
      }

      // Tenant users need to check feature access
      if (userRole === 'tenant' || req.user.isTenant) {
        
        // Check subscription status first
        const subscription = await Subscription.findOne({ userId });

        if (!subscription) {
          return res.status(403).json({
            success: false,
            code: 'NO_SUBSCRIPTION',
            message: 'No active subscription found. Please start a trial or subscribe.'
          });
        }

        // Check if subscription is active
        if (!['trial', 'active', 'grace-period'].includes(subscription.status)) {
          return res.status(403).json({
            success: false,
            code: 'SUBSCRIPTION_EXPIRED',
            message: 'Your subscription has expired. Please renew to continue.',
            data: {
              status: subscription.status,
              expiredAt: subscription.yearlyEndDate || subscription.trialEndDate
            }
          });
        }

        // For trial, check if limits exceeded
        if (subscription.planType === 'trial') {
          if (subscription.trialOrdersUsed >= subscription.trialOrdersLimit) {
            return res.status(403).json({
              success: false,
              code: 'TRIAL_LIMIT_REACHED',
              message: 'Trial order limit reached. Please upgrade to continue.',
              data: {
                ordersUsed: subscription.trialOrdersUsed,
                ordersLimit: subscription.trialOrdersLimit
              }
            });
          }

          if (new Date() > subscription.trialEndDate) {
            return res.status(403).json({
              success: false,
              code: 'TRIAL_EXPIRED',
              message: 'Trial period expired. Please upgrade to continue.',
              data: {
                trialEndDate: subscription.trialEndDate
              }
            });
          }
        }

        // Check feature access
        const tenantSettings = await TenantSettings.findOne({ userId });

        if (!tenantSettings) {
          return res.status(403).json({
            success: false,
            code: 'SETTINGS_NOT_FOUND',
            message: 'Tenant settings not found'
          });
        }

        // Check if module is enabled
        if (!tenantSettings.enabledModules.includes(requiredModule)) {
          return res.status(403).json({
            success: false,
            code: 'FEATURE_NOT_ENABLED',
            message: `Access denied. The "${requiredModule}" feature is not enabled for your account.`,
            data: {
              requiredModule,
              enabledModules: tenantSettings.enabledModules,
              hint: 'Contact your administrator to enable this feature.'
            }
          });
        }

        // All checks passed
        logger.info('Feature access granted', { userId, module: requiredModule });
        return next();
      }

      // Unknown role
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });

    } catch (error) {
      logger.error('Feature access check failed', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Failed to verify feature access',
        error: error.message
      });
    }
  };
};

module.exports = checkFeatureAccess;
