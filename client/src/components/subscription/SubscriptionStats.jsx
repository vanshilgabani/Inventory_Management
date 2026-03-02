// src/components/subscription/SubscriptionStats.jsx

import React from 'react';
import { useSubscription } from '../../context/SubscriptionContext';

const SubscriptionStats = () => {
  const { subscription, usageStats } = useSubscription();

  if (!subscription || !usageStats) return null;

  const renderTrialStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Days Remaining */}
      <StatCard
        label="Days Remaining"
        value={usageStats.daysRemaining}
        total={7}
        unit="days"
        color="blue"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        }
      />

      {/* Orders Used */}
      <StatCard
        label="Orders Used"
        value={usageStats.ordersUsed}
        total={usageStats.ordersLimit}
        unit="orders"
        color="green"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
            />
          </svg>
        }
      />

      {/* Orders Remaining */}
      <StatCard
        label="Orders Remaining"
        value={usageStats.ordersRemaining}
        total={usageStats.ordersLimit}
        unit="orders"
        color="purple"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        }
      />
    </div>
  );

  const renderYearlyStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Days Remaining */}
      <StatCard
        label="Days Until Renewal"
        value={usageStats.daysRemaining}
        total={365}
        unit="days"
        color="blue"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        }
      />

      {/* Expiry Date */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Expiry Date</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {new Date(usageStats.expiryDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <div className="text-green-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMonthlyStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Days Remaining */}
      <StatCard
        label="Days Until Renewal"
        value={usageStats.daysRemaining}
        total={30}
        unit="days"
        color="blue"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        }
      />

      {/* Expiry Date */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Expiry Date</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {new Date(usageStats.expiryDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <div className="text-blue-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );

  const renderOrderBasedStats = () => (
    <div className="space-y-6">
      {/* Main Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Orders This Month */}
        <StatCard
          label="Orders This Month"
          value={usageStats.ordersThisMonth || 0}
          color="blue"
          unit="total orders"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
          }
        />

        {/* Price Per Order */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-600">Price Per Order</p>
            <div className="p-2 rounded-lg bg-yellow-50 border-yellow-200 text-yellow-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            ₹{usageStats.pricePerOrder?.toFixed(2) || '0.50'}
          </p>
          <p className="text-sm text-gray-500 mt-1">per order</p>
        </div>

        {/* Estimated Bill */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-green-700">Estimated Bill</p>
            <div className="p-2 rounded-lg bg-green-100 text-green-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"
                />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-green-900">
            ₹{usageStats.estimatedBill?.toFixed(2) || '0.00'}
          </p>
          <p className="text-xs text-green-700 mt-2 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Due: {usageStats.nextBillingDate 
              ? new Date(usageStats.nextBillingDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })
              : 'End of month'
            }
          </p>
        </div>
      </div>

      {/* Order Breakdown */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Order Breakdown
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Marketplace Orders */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-700">Marketplace</span>
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-blue-900">
              {usageStats.marketplaceOrders || 0}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              ≈ ₹{((usageStats.marketplaceOrders || 0) * (usageStats.pricePerOrder || 0)).toFixed(2)}
            </p>
          </div>

          {/* Direct Sales */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-purple-700">Direct Sales</span>
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-purple-900">
              {usageStats.directOrders || 0}
            </p>
            <p className="text-xs text-purple-600 mt-1">
              ≈ ₹{((usageStats.directOrders || 0) * (usageStats.pricePerOrder || 0)).toFixed(2)}
            </p>
          </div>

          {/* Wholesale Orders */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-orange-700">Wholesale</span>
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-orange-900">
              {usageStats.wholesaleOrders || 0}
            </p>
            <p className="text-xs text-orange-600 mt-1">
              ≈ ₹{((usageStats.wholesaleOrders || 0) * (usageStats.pricePerOrder || 0)).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Billing Cycle Info */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Current billing cycle:</span>
            <span className="font-semibold text-gray-900">
              {usageStats.billingCycleStart 
                ? new Date(usageStats.billingCycleStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                : 'N/A'
              } - {usageStats.billingCycleEnd
                ? new Date(usageStats.billingCycleEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'N/A'
              }
            </span>
          </div>
        </div>
      </div>

      {/* Info Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm text-blue-900">
              <strong>How order-based billing works:</strong> You pay only for the orders you process each month. 
              Invoice will be generated at the end of the billing cycle with a 7-day grace period to pay.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="mb-8">
      {subscription.planType === 'trial' && renderTrialStats()}
      {subscription.planType === 'yearly' && renderYearlyStats()}
      {subscription.planType === 'monthly' && renderMonthlyStats()}
      {subscription.planType === 'order-based' && renderOrderBasedStats()}
    </div>
  );
};

// Stat Card Component
const StatCard = ({ label, value, total, unit, color, icon }) => {
  const getColorClasses = () => {
    const colors = {
      blue: 'bg-blue-50 border-blue-200 text-blue-600',
      green: 'bg-green-50 border-green-200 text-green-600',
      purple: 'bg-purple-50 border-purple-200 text-purple-600',
      yellow: 'bg-yellow-50 border-yellow-200 text-yellow-600',
    };
    return colors[color] || colors.blue;
  };

  const percentage = total ? Math.round((value / total) * 100) : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-gray-600">{label}</p>
        <div className={`p-2 rounded-lg ${getColorClasses()}`}>{icon}</div>
      </div>
      <div>
        <p className="text-3xl font-bold text-gray-900">
          {value}
          {total && <span className="text-lg text-gray-500">/{total}</span>}
        </p>
        {unit && <p className="text-sm text-gray-500 mt-1">{unit}</p>}
      </div>
      {total && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${getColorClasses().split(' ')[0]}`}
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionStats;
