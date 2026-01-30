// src/components/subscription/UpgradePlanModal.jsx
import React, { useState, useEffect } from 'react';
import { upgradePlan } from '../../services/subscriptionService';
import { createPaymentOrder, verifyPayment } from '../../services/paymentService';
import { useSubscription } from '../../context/SubscriptionContext';
import api from '../../services/api';

const UpgradePlanModal = ({ onClose }) => {
  const { refreshSubscription } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [plans, setPlans] = useState([]);
  const [fetchingPrices, setFetchingPrices] = useState(true);

  // ✅ Fetch pricing from backend on mount
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
                'No setup fee'
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
              savings: Math.round((pricing.monthly * 12) - pricing.yearly), // Calculate savings
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

      // For yearly/monthly plan: Open Razorpay payment modal
      if (['yearly', 'monthly'].includes(selectedPlan)) {
        // Step 1: Create Razorpay order
        const orderResponse = await createPaymentOrder(selectedPlan);

        if (!orderResponse.success) {
          throw new Error(orderResponse.message);
        }

        const { orderId, amount, currency, key } = orderResponse.data;

        // Step 2: Open Razorpay checkout
        const options = {
          key: key, // Razorpay Key ID from backend
          amount: amount, // Amount in paise
          currency: currency,
          name: 'VeeRaa Inventory System',
          description: `${selectedPlan === 'yearly' ? 'Yearly' : 'Monthly'} Subscription Plan`,
          order_id: orderId,
          handler: async function (response) {
            try {
              // Step 3: Verify payment on backend
              const verifyResponse = await verifyPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                planType: selectedPlan
              });

              if (verifyResponse.success) {
                alert('Payment successful! Your plan has been upgraded.');
                await refreshSubscription();
                onClose();
              } else {
                setError('Payment verification failed');
              }
            } catch (err) {
              setError('Payment verification failed: ' + err.message);
            }
          },
          prefill: {
            name: '',
            email: '',
            contact: ''
          },
          theme: {
            color: '#6366F1'
          },
          modal: {
            ondismiss: function() {
              setLoading(false);
              setError('Payment cancelled by user');
            }
          }
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();
        setLoading(false); // Reset loading after opening modal
        return;
      }

    } catch (err) {
      setError(err.response?.data?.message || 'Upgrade failed');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingPrices) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading pricing...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Upgrade Your Plan</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-gray-600 mt-2">Choose the plan that fits your needs</p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative border-2 rounded-lg p-6 cursor-pointer transition-all ${
                  selectedPlan === plan.id
                    ? 'border-blue-500 shadow-lg'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Badge */}
                {plan.badge && (
                  <div className={`absolute top-4 right-4 ${plan.badgeColor} text-white text-xs px-3 py-1 rounded-full font-semibold`}>
                    {plan.badge}
                  </div>
                )}

                {/* Plan Name */}
                <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                
                {/* Description */}
                <p className="text-sm text-gray-600 mb-4">{plan.description}</p>

                {/* Price */}
                <div className="mb-4">
                  <span className="text-3xl font-bold text-gray-900">{plan.priceLabel}</span>
                  {plan.savings && (
                    <p className="text-sm text-green-600 mt-1">
                      💰 Save ₹{plan.savings.toLocaleString()} per year
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Selection Indicator */}
                {selectedPlan === plan.id && (
                  <div className="absolute inset-0 border-4 border-blue-500 rounded-lg pointer-events-none"></div>
                )}
              </div>
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex justify-end gap-4">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpgrade}
              disabled={!selectedPlan || loading}
              className={`px-6 py-2 rounded-lg font-semibold ${
                !selectedPlan || loading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {loading ? 'Processing...' : 'Upgrade Now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradePlanModal;
