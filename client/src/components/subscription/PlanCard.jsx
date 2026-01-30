// components/subscription/PlanCard.jsx
import { useState } from 'react';
import { FiCheck, FiZap, FiClock } from 'react-icons/fi';
import RazorpayPayment from './RazorpayPayment';

const PlanCard = ({ plan, currentPlan, onUpgrade, user }) => {
  const [upgrading, setUpgrading] = useState(false);
  
  const isCurrentPlan = currentPlan?.planType === plan.type;
  const isDowngrade = 
    (currentPlan?.planType === 'yearly' && plan.type !== 'yearly') ||
    (currentPlan?.planType === 'monthly' && plan.type === 'order-based');

  const handleUpgradeSuccess = (data) => {
    setUpgrading(false);
    if (onUpgrade) {
      onUpgrade(data);
    }
  };

  const handleUpgradeError = (error) => {
    setUpgrading(false);
    console.error('Upgrade error:', error);
  };

  return (
    <div
      className={`relative rounded-2xl border-2 transition-all hover:shadow-xl ${
        plan.popular
          ? 'border-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50'
          : isCurrentPlan
          ? 'border-green-500 bg-green-50'
          : 'border-gray-200 bg-white hover:border-indigo-300'
      }`}
    >
      {/* Popular Badge */}
      {plan.popular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <span className="inline-flex items-center px-4 py-1 rounded-full text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg">
            ⭐ Most Popular
          </span>
        </div>
      )}

      {/* Current Plan Badge */}
      {isCurrentPlan && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <span className="inline-flex items-center px-4 py-1 rounded-full text-sm font-bold text-white bg-green-600 shadow-lg">
            <FiCheck className="mr-1" size={14} />
            Current Plan
          </span>
        </div>
      )}

      <div className="p-6 pt-8">
        {/* Plan Name */}
        <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>

        {/* Price */}
        <div className="mb-4">
          {plan.type === 'trial' ? (
            <div>
              <span className="text-5xl font-extrabold text-gray-900">Free</span>
              <span className="text-gray-600 ml-2">{plan.billing}</span>
            </div>
          ) : (
            <div className="flex items-baseline">
              <span className="text-2xl font-bold text-gray-900">₹</span>
              <span className="text-5xl font-extrabold text-gray-900">{plan.price}</span>
              <span className="text-gray-600 ml-2">/{plan.billing}</span>
            </div>
          )}
        </div>

        {/* Savings Badge */}
        {plan.savings && (
          <div className="mb-4">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800">
              💰 Save ₹{plan.savings.toLocaleString()} per year
            </span>
          </div>
        )}

        {/* Features List */}
        <ul className="space-y-3 mb-6">
          {plan.features?.map((feature, index) => (
            <li key={index} className="flex items-start">
              <FiCheck className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700 text-sm">{feature}</span>
            </li>
          ))}
        </ul>

        {/* Action Button */}
        <div className="mt-6">
          {isCurrentPlan ? (
            <button
              disabled
              className="w-full py-3 px-4 rounded-lg font-semibold text-gray-600 bg-gray-200 cursor-not-allowed"
            >
              Current Plan
            </button>
          ) : isDowngrade ? (
            <button
              disabled
              className="w-full py-3 px-4 rounded-lg font-semibold text-gray-500 bg-gray-100 cursor-not-allowed"
            >
              Not Available
            </button>
          ) : plan.type === 'trial' ? (
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">
                <FiClock className="inline mr-1" />
                Already on trial
              </p>
            </div>
          ) : (
            <RazorpayPayment
              planType={plan.type}
              planName={plan.name}
              onSuccess={handleUpgradeSuccess}
              onError={handleUpgradeError}
              user={user}
            >
              <button
                disabled={upgrading}
                className={`w-full py-3 px-4 rounded-lg font-bold transition-all transform hover:scale-105 ${
                  plan.popular
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-lg'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                } ${upgrading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {upgrading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <FiZap className="mr-2" size={18} />
                    {plan.type === 'order-based' ? 'Switch to This Plan' : 'Upgrade Now'}
                  </span>
                )}
              </button>
            </RazorpayPayment>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlanCard;
