// src/contexts/SubscriptionContext.jsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSubscription } from '../services/subscriptionService';

const SubscriptionContext = createContext();

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
};

export const SubscriptionProvider = ({ children }) => {
  const [subscription, setSubscription] = useState(null);
  const [usageStats, setUsageStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch subscription on mount
  const fetchSubscription = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getSubscription();
      
      if (response.success) {
        setSubscription(response.data.subscription);
        setUsageStats(response.data.usageStats);
      }
    } catch (err) {
      // No subscription found is not an error - user might need to start trial
      if (err.response?.status === 404) {
        setSubscription(null);
        setUsageStats(null);
      } else {
        setError(err.response?.data?.message || 'Failed to fetch subscription');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  // Check if subscription is active
  const isActive = () => {
    if (!subscription) return false;
    return ['trial', 'active', 'grace-period'].includes(subscription.status);
  };

  // Check if trial
  const isTrial = () => {
    return subscription?.planType === 'trial';
  };

  // ✅ Check if in grace period
  const isGracePeriod = () => {
    return subscription?.status === 'grace-period';
  };

  // ✅ Check if expired
  const isExpired = () => {
    return subscription?.status === 'expired';
  };

  // Check if expiring soon
  const isExpiringSoon = () => {
    return usageStats?.isExpiringSoon || false;
  };

  // Check if limit reached (trial)
  const isLimitReached = () => {
    return usageStats?.isLimitReached || false;
  };

  // Get warning message
  const getWarningMessage = () => {
    if (!subscription) return null;

    // ✅ Grace period and expired handled by UsageWarningBanner directly
    if (subscription.status === 'grace-period') return null;
    if (subscription.status === 'expired') return null;

    // Trial warnings
    if (subscription.planType === 'trial') {
      if (usageStats?.isLimitReached) {
        return {
          type: 'error',
          message: `Trial order limit reached (${usageStats.ordersUsed}/${usageStats.ordersLimit}). Please upgrade to continue.`,
        };
      }
      
      if (usageStats?.isExpiringSoon) {
        return {
          type: 'warning',
          message: `Trial expires in ${usageStats.daysRemaining} days. Upgrade now to keep your data.`,
        };
      }

      // ✅ Show info when trial is active but not expiring
      if (usageStats?.daysRemaining > 3) {
        return {
          type: 'info',
          message: `Trial: ${usageStats.daysRemaining} days remaining, ${usageStats.ordersRemaining} orders left.`,
        };
      }
    }

    // ✅ Yearly plan expiring soon
    if (subscription.planType === 'yearly' && usageStats?.isExpiringSoon) {
      return {
        type: 'warning',
        message: `Yearly subscription expires in ${usageStats.daysRemaining} days. Renew to avoid service interruption.`,
      };
    }

    // ✅ Monthly plan expiring soon
    if (subscription.planType === 'monthly' && usageStats?.isExpiringSoon) {
      return {
        type: 'warning',
        message: `Monthly subscription expires in ${usageStats.daysRemaining} days. Renew to avoid service interruption.`,
      };
    }

    // ✅ Order-based plan info
    if (subscription.planType === 'order-based' && subscription.status === 'active') {
      if (usageStats?.ordersThisMonth > 0) {
        return {
          type: 'info',
          message: `Order-based plan: ${usageStats.ordersThisMonth} orders this month (₹${usageStats.estimatedBill?.toFixed(2) || 0} estimated).`,
        };
      }
    }

    return null;
  };

  const value = {
    subscription,
    usageStats,
    loading,
    error,
    isActive,
    isTrial,
    isGracePeriod, // ✅ Added
    isExpired, // ✅ Added
    isExpiringSoon,
    isLimitReached,
    getWarningMessage,
    refreshSubscription: fetchSubscription,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};
