// src/pages/TrialInitializationPage.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { initializeTrial } from '../services/subscriptionService';
import { useSubscription } from '../context/SubscriptionContext';

const TrialInitializationPage = () => {
  const navigate = useNavigate();
  const { refreshSubscription } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleStartTrial = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await initializeTrial();

      if (response.success) {
        // Refresh subscription context
        await refreshSubscription();
        
        // Show success message
        alert(response.message);
        
        // Redirect to dashboard
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start trial');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-100 rounded-full mb-4">
            <svg
              className="w-10 h-10 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Start Your Free Trial
          </h1>
          <p className="text-gray-600">
            Get full access to all features for 14 days
          </p>
        </div>

        {/* Features */}
        <div className="space-y-4 mb-8">
          <FeatureItem
            icon="✓"
            title="14 Days Free Trial"
            description="No credit card required"
          />
          <FeatureItem
            icon="✓"
            title="50 Free Orders"
            description="Test with real marketplace orders"
          />
          <FeatureItem
            icon="✓"
            title="Full Feature Access"
            description="Inventory management + Marketplace sales"
          />
          <FeatureItem
            icon="✓"
            title="Sync with Suppliers"
            description="Automatic inventory updates"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* CTA Button */}
        <button
          onClick={handleStartTrial}
          disabled={loading}
          className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Starting Trial...
            </span>
          ) : (
            'Start Free Trial'
          )}
        </button>

        {/* Terms */}
        <p className="text-xs text-gray-500 text-center mt-4">
          By starting your trial, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
};

// Feature Item Component
const FeatureItem = ({ icon, title, description }) => (
  <div className="flex items-start space-x-3">
    <div className="flex-shrink-0">
      <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-600 rounded-full text-sm font-bold">
        {icon}
      </span>
    </div>
    <div>
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  </div>
);

export default TrialInitializationPage;
