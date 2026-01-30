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
    if (!subscription || !usageStats) return null;

    if (subscription.planType === 'trial') {
      if (usageStats.isLimitReached) {
        return {
          type: 'error',
          message: `Trial order limit reached (${usageStats.ordersUsed}/${usageStats.ordersLimit}). Please upgrade to continue.`,
        };
      }
      if (usageStats.isExpiringSoon) {
        return {
          type: 'warning',
          message: `Trial expires in ${usageStats.daysRemaining} days. Upgrade now to keep your data.`,
        };
      }
    }

    if (subscription.planType === 'yearly' && usageStats.isExpiringSoon) {
      return {
        type: 'warning',
        message: `Subscription expires in ${usageStats.daysRemaining} days. Renew to avoid service interruption.`,
      };
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
