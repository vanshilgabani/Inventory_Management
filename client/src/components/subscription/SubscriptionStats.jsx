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

  const renderOrderBasedStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Orders This Month */}
      <StatCard
        label="Orders This Month"
        value={usageStats.ordersThisMonth}
        color="blue"
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
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Price Per Order</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              ₹{usageStats.pricePerOrder}
            </p>
          </div>
          <div className="text-yellow-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Estimated Bill */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-700">Estimated Bill</p>
            <p className="text-2xl font-bold text-green-900 mt-1">
              ₹{usageStats.estimatedBill.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-green-600 mt-1">
              Due: {new Date(usageStats.nextBillingDate).toLocaleDateString('en-IN')}
            </p>
          </div>
          <div className="text-green-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="mb-8">
      {subscription.planType === 'trial' && renderTrialStats()}
      {subscription.planType === 'yearly' && renderYearlyStats()}
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
