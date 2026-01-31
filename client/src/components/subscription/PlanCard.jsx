// components/subscription/PlanCard.jsx
import { useState } from 'react';
import { FiCheck, FiZap, FiClock } from 'react-icons/fi';
import ManualPaymentModal from './ManualPaymentModal';

const PlanCard = ({ plan, currentPlan, onUpgrade, user }) => {
  const [upgrading, setUpgrading] = useState(false);
  const [showManualPayment, setShowManualPayment] = useState(false);

  const isCurrentPlan = currentPlan?.planType === plan.type;
  const isDowngrade =
    (currentPlan?.planType === 'yearly' && plan.type !== 'yearly') ||
    (currentPlan?.planType === 'monthly' && plan.type === 'order-based');

  const handleUpgradeSuccess = (data) => {
    setUpgrading(false);
    setShowManualPayment(false);
    if (onUpgrade) {
      onUpgrade(data);
    }
  };

  const handleUpgradeError = (error) => {
    setUpgrading(false);
    console.error('Upgrade error:', error);
  };

  const handleUpgradeClick = () => {
    setUpgrading(true);
    setShowManualPayment(true);
  };

  return (
    <>
      <div
        className={`bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-2xl ${
          plan.popular ? 'ring-2 ring-blue-500' : ''
        }`}
      >
        {/* Badge */}
        {plan.badge && (
          <div className={`${plan.badgeColor} text-white text-center py-2 text-sm font-semibold`}>
            {plan.badge}
          </div>
        )}

        <div className="p-6">
          {/* Plan Name */}
          <h3 className="text-2xl font-bold text-gray-800 mb-2">{plan.name}</h3>
          <p className="text-gray-600 text-sm mb-4">{plan.description}</p>

          {/* Price */}
          <div className="mb-6">
            <div className="flex items-baseline">
              <span className="text-4xl font-bold text-gray-900">
                ₹{plan.price.toLocaleString()}
              </span>
              <span className="text-gray-600 ml-2">/{plan.billing}</span>
            </div>
            {plan.savings && (
              <p className="text-green-600 text-sm mt-2 font-semibold">
                💰 Save ₹{plan.savings.toLocaleString()} per year
              </p>
            )}
          </div>

          {/* Features */}
          <ul className="space-y-3 mb-6">
            {plan.features.map((feature, index) => (
              <li key={index} className="flex items-start">
                <FiCheck className="text-green-500 mt-1 mr-2 flex-shrink-0" />
                <span className="text-gray-700 text-sm">{feature}</span>
              </li>
            ))}
          </ul>

          {/* CTA Button */}
          {isCurrentPlan ? (
            <button
              disabled
              className="w-full py-3 px-4 bg-gray-200 text-gray-500 rounded-lg font-semibold cursor-not-allowed"
            >
              Current Plan
            </button>
          ) : isDowngrade ? (
            <button
              disabled
              className="w-full py-3 px-4 bg-gray-200 text-gray-500 rounded-lg font-semibold cursor-not-allowed"
            >
              Not Available
            </button>
          ) : (
            <button
              onClick={handleUpgradeClick}
              disabled={upgrading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {upgrading ? 'Processing...' : 'Upgrade Now'}
            </button>
          )}
        </div>
      </div>

      {/* Manual Payment Modal */}
      {showManualPayment && (
        <ManualPaymentModal
          onClose={() => {
            setShowManualPayment(false);
            setUpgrading(false);
          }}
          planType={plan.type}
          planName={plan.name}
          amount={plan.price}
          onSuccess={handleUpgradeSuccess}
        />
      )}
    </>
  );
};

export default PlanCard;
