// src/components/subscription/UsageWarningBanner.jsx

import React, { useState, useEffect } from 'react';
import { useSubscription } from '../../context/SubscriptionContext';
import { useNavigate } from 'react-router-dom';
import { FiAlertCircle, FiClock, FiXCircle, FiAlertTriangle } from 'react-icons/fi';
import api from '../../services/api';

const UsageWarningBanner = () => {
  const { subscription, getWarningMessage } = useSubscription();
  const navigate = useNavigate();
  const [pendingInvoice, setPendingInvoice] = useState(null);
  const [loading, setLoading] = useState(false);

  const warning = getWarningMessage();

  useEffect(() => {
    if (subscription?.status === 'grace-period') {
      fetchPendingInvoice();
    }
  }, [subscription]);

  const fetchPendingInvoice = async () => {
    try {
      setLoading(true);
      const response = await api.get('/subscription/invoices?status=generated&limit=1');
      if (response.data.success && response.data.data.invoices.length > 0) {
        setPendingInvoice(response.data.data.invoices[0]);
      }
    } catch (error) {
      console.error('Failed to fetch pending invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Priority 1: Grace Period Warning (Order-based plan)
  if (subscription?.status === 'grace-period' && subscription.gracePeriodEndDate) {
    const daysLeft = Math.ceil(
      (new Date(subscription.gracePeriodEndDate) - new Date()) / (1000 * 60 * 60 * 24)
    );
    const isUrgent = daysLeft <= 2;

    return (
      <div className={`mb-6 rounded-lg p-5 shadow-lg border-2 ${
        isUrgent 
          ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-400 animate-pulse' 
          : 'bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-400'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 ${isUrgent ? 'text-red-600' : 'text-orange-600'}`}>
            {isUrgent ? (
              <FiXCircle className="text-3xl animate-bounce" />
            ) : (
              <FiAlertCircle className="text-3xl" />
            )}
          </div>
          
          <div className="flex-1">
            <h3 className={`text-lg font-bold mb-2 ${
              isUrgent ? 'text-red-900' : 'text-orange-900'
            }`}>
              {isUrgent ? '🚨 Urgent: Payment Required!' : '⚠️ Payment Pending - Grace Period Active'}
            </h3>
            
            <div className="space-y-2">
              {pendingInvoice ? (
                <>
                  <p className={isUrgent ? 'text-red-800' : 'text-orange-800'}>
                    Your invoice of <strong className="text-xl">₹{pendingInvoice.totalAmount.toLocaleString()}</strong> is overdue.
                    {daysLeft > 0 ? (
                      <>
                        {' '}You have <strong className={isUrgent ? 'text-red-600 text-lg' : 'text-orange-600'}>{daysLeft} day{daysLeft !== 1 ? 's' : ''}</strong> left to pay.
                      </>
                    ) : (
                      <strong className="text-red-600"> Payment is due TODAY!</strong>
                    )}
                  </p>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <FiClock className={isUrgent ? 'text-red-600' : 'text-orange-600'} />
                    <span className={isUrgent ? 'text-red-700 font-semibold' : 'text-orange-700'}>
                      Grace period ends: {new Date(subscription.gracePeriodEndDate).toLocaleDateString('en-IN', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </span>
                  </div>

                  {pendingInvoice.billingPeriod && (
                    <p className="text-sm text-gray-600 mt-1">
                      Invoice for: <strong>{pendingInvoice.billingPeriod.month}</strong> 
                      {' '}({pendingInvoice.items[0]?.quantity || 0} orders)
                    </p>
                  )}
                </>
              ) : (
                <p className={isUrgent ? 'text-red-800' : 'text-orange-800'}>
                  You have an unpaid invoice. Please pay within <strong>{daysLeft} day{daysLeft !== 1 ? 's' : ''}</strong> to avoid service interruption.
                </p>
              )}
              
              {daysLeft <= 0 && (
                <p className="text-red-700 font-bold text-sm mt-2 bg-red-100 p-2 rounded">
                  ⚠️ Your account will be suspended after today if payment is not received!
                </p>
              )}
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => navigate('/invoices')}
                className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                  isUrgent
                    ? 'bg-red-600 text-white hover:bg-red-700 shadow-lg'
                    : 'bg-orange-600 text-white hover:bg-orange-700'
                }`}
              >
                Pay Now
              </button>
              <button
                onClick={() => navigate('/subscription')}
                className="px-6 py-2 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-semibold transition-all"
              >
                View Details
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ✅ Priority 2: Expired Subscription
  if (subscription?.status === 'expired') {
    return (
      <div className="mb-6 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-500 rounded-lg p-5 shadow-lg">
        <div className="flex items-start gap-4">
          <FiXCircle className="text-red-600 text-3xl flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-lg font-bold text-red-900 mb-2">
              ❌ Subscription Expired
            </h3>
            <p className="text-red-800 mb-3">
              Your subscription has expired. Please renew your plan to continue using the service.
            </p>
            {pendingInvoice && (
              <p className="text-sm text-red-700 mb-3">
                You have an unpaid invoice of <strong>₹{pendingInvoice.totalAmount.toLocaleString()}</strong>. 
                Pay now to reactivate your account.
              </p>
            )}
            <div className="flex gap-3">
              {pendingInvoice ? (
                <button
                  onClick={() => navigate('/invoices')}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
                >
                  Pay Invoice
                </button>
              ) : null}
              <button
                onClick={() => navigate('/subscription')}
                className="px-6 py-2 bg-white border-2 border-red-500 text-red-600 rounded-lg hover:bg-red-50 font-semibold"
              >
                Renew Plan
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ✅ Priority 3: Other warnings from context (trial ending, etc.)
  if (warning) {
    const getBgColor = () => {
      switch (warning.type) {
        case 'error':
          return 'bg-red-50 border-red-300';
        case 'warning':
          return 'bg-yellow-50 border-yellow-300';
        default:
          return 'bg-blue-50 border-blue-300';
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
          return <FiXCircle className="text-2xl" />;
        case 'warning':
          return <FiAlertTriangle className="text-2xl" />;
        default:
          return <FiAlertCircle className="text-2xl" />;
      }
    };

    return (
      <div className={`border-l-4 p-4 mb-6 rounded-r-lg ${getBgColor()}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={getTextColor()}>{getIcon()}</div>
            <p className={`font-medium ${getTextColor()}`}>{warning.message}</p>
          </div>
          <button
            onClick={() => navigate('/subscription')}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            {warning.type === 'error' ? 'Renew Now' : 'Upgrade Now'}
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default UsageWarningBanner;
