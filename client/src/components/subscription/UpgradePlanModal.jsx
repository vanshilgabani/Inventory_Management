// src/components/subscription/UpgradePlanModal.jsx
import React, { useState, useEffect } from 'react';
import { upgradePlan } from '../../services/subscriptionService';
import { useSubscription } from '../../context/SubscriptionContext';
import ManualPaymentModal from './ManualPaymentModal';
import api from '../../services/api';

const UpgradePlanModal = ({ onClose }) => {
  const { refreshSubscription } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [plans, setPlans] = useState([]);
  const [fetchingPrices, setFetchingPrices] = useState(true);
  const [showManualPayment, setShowManualPayment] = useState(false);
  const [selectedPlanData, setSelectedPlanData] = useState(null);

  // Fetch pricing from backend on mount
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        setFetchingPrices(true);
        const response = await api.get('/payment/pricing');

        if (response.data.success) {
          const pricing = response.data.data;

          // Build plans array with fetched prices
          setPlans([
            {
              id: 'monthly',
              name: 'Monthly Plan',
              price: pricing.monthly,
              priceLabel: `₹${pricing.monthly.toLocaleString()}/month`,
              description: 'Perfect for small businesses',
              features: [
                'All features included',
                'Monthly billing',
                'Email support',
                'Cancel anytime',
                'No setup fee',
              ],
              badge: 'Starter',
              badgeColor: 'bg-purple-500',
            },
            {
              id: 'yearly',
              name: 'Yearly Plan',
              price: pricing.yearly,
              priceLabel: `₹${pricing.yearly.toLocaleString()}/year`,
              description: 'Best value for growing businesses',
              features: [
                'Unlimited orders',
                'All features included',
                'Priority support',
                'Advanced analytics',
                'Supplier sync',
                'No per-order charges',
              ],
              badge: 'Popular',
              badgeColor: 'bg-green-500',
              savings: Math.round(pricing.monthly * 12 - pricing.yearly),
            },
            {
              id: 'order-based',
              name: 'Order-Based Plan',
              price: pricing.orderBased,
              priceLabel: `₹${pricing.orderBased}/order`,
              description: 'Pay only for what you use',
              features: [
                'Pay per marketplace order',
                'All features included',
                'Monthly billing',
                'No upfront cost',
                'Cancel anytime',
              ],
              badge: 'Flexible',
              badgeColor: 'bg-blue-500',
            },
          ]);
        }
      } catch (err) {
        console.error('Failed to fetch pricing:', err);
        setError('Failed to load pricing. Please try again.');
      } finally {
        setFetchingPrices(false);
      }
    };

    fetchPricing();
  }, []);

  const handleUpgrade = async () => {
    if (!selectedPlan) {
      setError('Please select a plan');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // For order-based plan: No payment needed
      if (selectedPlan === 'order-based') {
        const response = await upgradePlan(selectedPlan, {});
        if (response.success) {
          alert(response.message);
          await refreshSubscription();
          onClose();
        }
        return;
      }

      // For yearly/monthly plan: Open Manual Payment Modal
      if (['yearly', 'monthly'].includes(selectedPlan)) {
        const planData = plans.find((p) => p.id === selectedPlan);
        setSelectedPlanData(planData);
        setShowManualPayment(true);
        setLoading(false);
        return;
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Upgrade failed');
    } finally {
      setLoading(false);
    }
  };

  const handleManualPaymentSuccess = async () => {
    setShowManualPayment(false);
    await refreshSubscription();
    onClose();
  };

  if (fetchingPrices) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading pricing...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-xl">
            <h2 className="text-3xl font-bold mb-2">Upgrade Your Plan</h2>
            <p className="text-blue-100">Choose the plan that fits your needs</p>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`relative cursor-pointer rounded-xl border-2 transition-all duration-300 ${
                    selectedPlan === plan.id
                      ? 'border-blue-500 bg-blue-50 shadow-lg transform scale-105'
                      : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                  }`}
                >
                  {/* Badge */}
                  {plan.badge && (
                    <div
                      className={`${plan.badgeColor} text-white text-center py-2 text-sm font-semibold rounded-t-xl`}
                    >
                      {plan.badge}
                    </div>
                  )}

                  <div className="p-6">
                    {/* Plan Name */}
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{plan.name}</h3>
                    <p className="text-gray-600 text-sm mb-4">{plan.description}</p>

                    {/* Price */}
                    <div className="mb-4">
                      <div className="text-3xl font-bold text-gray-900">{plan.priceLabel}</div>
                      {plan.savings && (
                        <p className="text-green-600 text-sm mt-2 font-semibold">
                          💰 Save ₹{plan.savings.toLocaleString()} per year
                        </p>
                      )}
                    </div>

                    {/* Features */}
                    <ul className="space-y-2">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start text-sm text-gray-700">
                          <span className="text-green-500 mr-2">✓</span>
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {/* Selection Indicator */}
                    {selectedPlan === plan.id && (
                      <div className="mt-4 flex items-center justify-center">
                        <div className="bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-semibold">
                          ✓ Selected
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-semibold"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleUpgrade}
                disabled={!selectedPlan || loading}
                className={`flex-1 px-6 py-3 rounded-lg font-semibold transition ${
                  selectedPlan && !loading
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {loading ? 'Processing...' : 'Proceed to Payment'}
              </button>
            </div>

            {/* FAQ Section */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h4 className="font-semibold text-gray-800 mb-4">Frequently Asked Questions</h4>
              <div className="space-y-3 text-sm text-gray-600">
                <div>
                  <p className="font-semibold text-gray-700">
                    Can I upgrade from monthly to yearly?
                  </p>
                  <p>
                    Yes! You can upgrade anytime. Remaining credits will be adjusted automatically.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-gray-700">
                    What happens when my trial expires?
                  </p>
                  <p>
                    You can choose any paid plan. Your data remains safe for 30 days.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-gray-700">
                    Can I switch from monthly to yearly mid-billing?
                  </p>
                  <p>
                    Yes! Unused days will be credited towards your yearly subscription.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Payment Modal */}
      {showManualPayment && selectedPlanData && (
        <ManualPaymentModal
          onClose={() => {
            setShowManualPayment(false);
            setLoading(false);
          }}
          planType={selectedPlanData.id}
          planName={selectedPlanData.name}
          amount={selectedPlanData.price}
          onSuccess={handleManualPaymentSuccess}
        />
      )}
    </>
  );
};

export default UpgradePlanModal;
