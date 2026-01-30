// pages/SubscriptionDashboard.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import PlanCard from '../components/subscription/PlanCard';
import SubscriptionStats from '../components/subscription/SubscriptionStats';
import UsageWarningBanner from '../components/subscription/UsageWarningBanner';

const SubscriptionDashboard = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [usageStats, setUsageStats] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // ✅ Add error state

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // ✅ Check if pricing endpoint exists
      console.log('🔄 Fetching subscription and pricing...');
      
      const [subResponse, pricingResponse] = await Promise.all([
        api.get('/subscription').catch(err => {
          console.error('❌ Subscription fetch error:', err);
          return { data: { success: false } };
        }),
        api.get('/payment/pricing').catch(err => {
          console.error('❌ Pricing fetch error:', err);
          // ✅ Return default values if API fails
          return {
            data: {
              success: true,
              data: {
                yearly: 5999,
                monthly: 999,
                orderBased: 0.5,
                trial: {
                  days: 7,
                  ordersLimit: 500
                }
              }
            }
          };
        })
      ]);

      console.log('✅ Subscription response:', subResponse.data);
      console.log('✅ Pricing response:', pricingResponse.data);

      // Set subscription data
      if (subResponse.data.success) {
        setSubscription(subResponse.data.data.subscription);
        setUsageStats(subResponse.data.data.usageStats);
      }

      // Build plans array with fetched pricing
      if (pricingResponse.data.success) {
        const pricing = pricingResponse.data.data;

        const plansData = [
          {
            type: 'trial',
            name: 'Free Trial',
            price: 0,
            billing: `${pricing.trial.days} days`,
            trialDays: pricing.trial.days,
            features: [
              `${pricing.trial.days} days trial period`,
              `${pricing.trial.ordersLimit} orders limit`,
              'Full feature access',
            ]
          },
          {
            type: 'order-based',
            name: 'Pay Per Order',
            price: pricing.orderBased,
            billing: 'per order',
            features: [
              `₹${pricing.orderBased} per marketplace order`,
              'Pay only for what you use',
              'Monthly billing',
              'All features included',
            ]
          },
          {
            type: 'monthly',
            name: 'Monthly Plan',
            price: pricing.monthly,
            billing: 'month',
            features: [
              'Unlimited orders',
              'All features included',
              'Priority support',
              'Monthly billing',
            ]
          },
          {
            type: 'yearly',
            name: 'Annual Plan',
            price: pricing.yearly,
            billing: 'year',
            popular: true,
            savings: Math.round((pricing.monthly * 12) - pricing.yearly),
            features: [
              'Unlimited orders',
              'All features included',
              'Priority support',
              `Save ₹${Math.round((pricing.monthly * 12) - pricing.yearly).toLocaleString()}/year`,
              'Best value!'
            ]
          }
        ];

        console.log('✅ Plans built:', plansData);
        setPlans(plansData);
      }

    } catch (error) {
      console.error('❌ Failed to fetch data:', error);
      setError(error.message);
      toast.error('Failed to load subscription details');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradeSuccess = (data) => {
    toast.success('Plan upgraded successfully!');
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-lg">Loading subscription details...</p>
        </div>
      </div>
    );
  }

  // ✅ Show error if data fetch failed
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Failed to Load Plans</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ✅ Show message if no plans loaded
  if (plans.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">📦</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Plans Available</h2>
          <p className="text-gray-600 mb-4">Unable to load subscription plans. Please check your backend configuration.</p>
          <button
            onClick={fetchData}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Usage Warning Banner */}
      <UsageWarningBanner />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Subscription Plans
        </h1>
        <p className="text-gray-600">
          Choose the plan that fits your business needs
        </p>
      </div>

      {/* Current Subscription Stats */}
      {subscription && (
        <div className="mb-8">
          <SubscriptionStats />
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {plans.map((plan) => (
          <PlanCard
            key={plan.type}
            plan={plan}
            currentPlan={subscription}
            user={user}
            onUpgrade={handleUpgradeSuccess}
          />
        ))}
      </div>

      {/* FAQ Section */}
      <div className="bg-gray-50 rounded-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Frequently Asked Questions
        </h2>
        
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Can I upgrade anytime?
            </h3>
            <p className="text-gray-600">
              Yes! You can upgrade anytime. Remaining credits will be adjusted automatically.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              What happens after trial ends?
            </h3>
            <p className="text-gray-600">
              You can choose any paid plan. Your data remains safe for 30 days.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Can I switch from monthly to yearly?
            </h3>
            <p className="text-gray-600">
              Yes! Unused days will be credited towards your yearly subscription.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionDashboard;
