// components/subscription/PlanCard.jsx
import { useState } from 'react';
import { FiCheck, FiZap } from 'react-icons/fi';
import RazorpayPayment from './RazorpayPayment';

const PlanCard = ({ 
  plan, 
  currentPlan, 
  onUpgrade, 
  user 
}) => {
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

  // Free trial button (no payment)
  if (plan.type === 'trial') {
    return (
      <div className={`bg-white border-2 rounded-xl p-6 ${
        isCurrentPlan ? 'border-indigo-500' : 'border-gray-200'
      }`}>
        {isCurrentPlan && (
          <div className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full mb-4">
            Current Plan
          </div>
        )}
        
        <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-3xl font-bold">Free</span>
          {/* ✅ Dynamic trial days from backend */}
          <span className="text-gray-500">{plan.trialDays} days</span>
        </div>
        
        <ul className="space-y-3 mb-6">
          {plan.features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm">
              <FiCheck className="text-green-500 mt-0.5 flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        
        {isCurrentPlan && (
          <button
            disabled
            className="w-full py-3 rounded-lg bg-gray-100 text-gray-500 font-medium cursor-not-allowed"
          >
            Current Plan
          </button>
        )}
      </div>
    );
  }

  // Order-based plan (no upfront payment)
  if (plan.type === 'order-based') {
    return (
      <div className={`bg-white border-2 rounded-xl p-6 ${
        isCurrentPlan ? 'border-indigo-500' : 'border-gray-200'
      }`}>
        {isCurrentPlan && (
          <div className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full mb-4">
            Current Plan
          </div>
        )}
        
        <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
        <div className="flex items-baseline gap-2 mb-4">
          {/* ✅ Dynamic price from backend */}
          <span className="text-3xl font-bold">₹{plan.price}</span>
          <span className="text-gray-500">per order</span>
        </div>
        
        <ul className="space-y-3 mb-6">
          {plan.features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm">
              <FiCheck className="text-green-500 mt-0.5 flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        
        {!isCurrentPlan && (
          <RazorpayPayment
            planType="order-based"
            planName={plan.name}
            user={user}
            onSuccess={handleUpgradeSuccess}
            onError={handleUpgradeError}
          >
            {({ handlePayment, loading }) => (
              <button
                onClick={handlePayment}
                disabled={loading || isDowngrade}
                className={`w-full py-3 rounded-lg font-medium transition ${
                  isDowngrade
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {loading ? 'Processing...' : isDowngrade ? 'Cannot Downgrade' : 'Switch to This Plan'}
              </button>
            )}
          </RazorpayPayment>
        )}
        
        {isCurrentPlan && (
          <button
            disabled
            className="w-full py-3 rounded-lg bg-gray-100 text-gray-500 font-medium cursor-not-allowed"
          >
            Current Plan
          </button>
        )}
      </div>
    );
  }

  // Monthly or Yearly plans (require payment)
  return (
    <div className={`bg-white border-2 rounded-xl p-6 relative ${
      isCurrentPlan ? 'border-indigo-500' : 'border-gray-200'
    } ${plan.popular ? 'ring-2 ring-indigo-500' : ''}`}>
      
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-full">
          ⭐ Most Popular
        </div>
      )}
      
      {isCurrentPlan && (
        <div className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full mb-4">
          Current Plan
        </div>
      )}
      
      <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
      <div className="flex items-baseline gap-2 mb-1">
        {/* ✅ Dynamic price from backend */}
        <span className="text-3xl font-bold">₹{plan.price.toLocaleString()}</span>
        <span className="text-gray-500">/{plan.billing}</span>
      </div>
      
      {/* ✅ Dynamic savings calculation */}
      {plan.savings && (
        <p className="text-sm text-green-600 font-medium mb-4">
          💰 Save ₹{plan.savings.toLocaleString()} per year
        </p>
      )}
      
      <ul className="space-y-3 mb-6">
        {plan.features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm">
            <FiCheck className="text-green-500 mt-0.5 flex-shrink-0" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      
      {!isCurrentPlan && (
        <RazorpayPayment
          planType={plan.type}
          planName={plan.name}
          user={user}
          onSuccess={handleUpgradeSuccess}
          onError={handleUpgradeError}
        >
          {({ handlePayment, loading }) => (
            <button
              onClick={handlePayment}
              disabled={loading || isDowngrade}
              className={`w-full py-3 rounded-lg font-medium transition ${
                isDowngrade
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : plan.popular
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-gray-800 text-white hover:bg-gray-900'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </span>
              ) : isDowngrade ? (
                'Cannot Downgrade'
              ) : (
                <>
                  <FiZap className="inline mr-2" />
                  Upgrade Now
                </>
              )}
            </button>
          )}
        </RazorpayPayment>
      )}
      
      {isCurrentPlan && (
        <button
          disabled
          className="w-full py-3 rounded-lg bg-gray-100 text-gray-500 font-medium cursor-not-allowed"
        >
          Current Plan
        </button>
      )}
    </div>
  );
};

export default PlanCard;
