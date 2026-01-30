// src/components/subscription/UsageWarningBanner.jsx

import React from 'react';
import { useSubscription } from '../../context/SubscriptionContext';
import { useNavigate } from 'react-router-dom';

const UsageWarningBanner = () => {
  const { getWarningMessage } = useSubscription();
  const navigate = useNavigate();
  const warning = getWarningMessage();

  if (!warning) return null;

  const getBgColor = () => {
    switch (warning.type) {
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const getTextColor = () => {
    switch (warning.type) {
      case 'error':
        return 'text-red-800';
      case 'warning':
        return 'text-yellow-800';
      default:
        return 'text-blue-800';
    }
  };

  const getIcon = () => {
    switch (warning.type) {
      case 'error':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`border-l-4 p-4 mb-6 ${getBgColor()}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={getTextColor()}>{getIcon()}</div>
          <p className={`font-medium ${getTextColor()}`}>{warning.message}</p>
        </div>
        <button
          onClick={() => navigate('/subscription')}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
        >
          Upgrade Now
        </button>
      </div>
    </div>
  );
};

export default UsageWarningBanner;
