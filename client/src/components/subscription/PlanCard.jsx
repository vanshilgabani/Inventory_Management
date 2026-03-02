// components/subscription/PlanCard.jsx
import { useState } from 'react';
import { FiCheck, FiZap, FiClock, FiRefreshCw, FiAlertCircle, FiTrendingUp } from 'react-icons/fi';
import ManualPaymentModal from './ManualPaymentModal';
import api from '../../services/api';
import toast from 'react-hot-toast';

const PlanCard = ({ plan, currentPlan, onUpgrade, user }) => {
  const [upgrading, setUpgrading] = useState(false);
  const [showManualPayment, setShowManualPayment] = useState(false);
  const [checking, setChecking] = useState(false);

  // ✅ Determine plan status and button state
  const getPlanStatus = () => {
    if (!currentPlan) {
      return {
        isCurrent: false,
        isExpired: false,
        isGracePeriod: false,
        canUpgrade: plan.type !== 'trial',
        action: plan.type === 'trial' ? 'start' : 'subscribe'
      };
    }

    const isCurrentPlan = currentPlan.planType === plan.type;
    const isExpired = currentPlan.status === 'expired';
    const isGracePeriod = currentPlan.status === 'grace-period';
    const isActive = currentPlan.status === 'active';

    // ✅ If current plan is expired, allow choosing ANY plan
    if (isExpired || isGracePeriod) {
      if (isCurrentPlan) {
        return {
          isCurrent: true,
          isExpired: true,
          isGracePeriod,
          canUpgrade: true,
          action: 'renew'
        };
      } else {
        // Different plan - allow switching
        return {
          isCurrent: false,
          isExpired: false,
          isGracePeriod: false,
          canUpgrade: true,
          action: 'switch'
        };
      }
    }

    // Check if it's a downgrade (only for active subscriptions)
    const isDowngrade =
      (currentPlan.planType === 'yearly' && plan.type === 'monthly') ||
      (currentPlan.planType === 'yearly' && plan.type === 'order-based') ||
      (currentPlan.planType === 'monthly' && plan.type === 'order-based');

    // Current plan logic (active)
    if (isCurrentPlan && isActive) {
      return {
        isCurrent: true,
        isExpired: false,
        isGracePeriod: false,
        canUpgrade: true,
        action: 'extend'
      };
    }

    // Different plan logic (active)
    if (plan.type === 'trial' && currentPlan.planType !== 'trial') {
      return {
        isCurrent: false,
        isExpired: false,
        isGracePeriod: false,
        canUpgrade: false,
        action: 'trial-used'
      };
    }

    return {
      isCurrent: false,
      isExpired: false,
      isGracePeriod: false,
      canUpgrade: !isDowngrade,
      action: isDowngrade ? 'downgrade' : 'upgrade'
    };
  };

  const status = getPlanStatus();

  // ✅ Get button configuration
  const getButtonConfig = () => {
    if (!status.canUpgrade) {
      if (status.action === 'trial-used') {
        return {
          text: 'Trial Used',
          disabled: true,
          className: 'bg-gray-200 text-gray-500 cursor-not-allowed',
          icon: null
        };
      }
      if (status.action === 'downgrade') {
        return {
          text: 'Not Available',
          disabled: true,
          className: 'bg-gray-200 text-gray-500 cursor-not-allowed',
          icon: null
        };
      }
    }

    if (status.action === 'extend') {
      return {
        text: 'Extend Plan',
        disabled: false,
        className: 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700',
        icon: <FiRefreshCw className="inline mr-2" />
      };
    }

    if (status.action === 'renew') {
      return {
        text: 'Renew Plan',
        disabled: false,
        className: 'bg-gradient-to-r from-red-600 to-orange-600 text-white hover:from-red-700 hover:to-orange-700 animate-pulse',
        icon: <FiAlertCircle className="inline mr-2" />
      };
    }

    if (status.action === 'switch') {
      return {
        text: 'Switch to This Plan',
        disabled: false,
        className: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700',
        icon: <FiTrendingUp className="inline mr-2" />
      };
    }

    if (status.action === 'subscribe') {
      return {
        text: 'Subscribe Now',
        disabled: false,
        className: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700',
        icon: <FiZap className="inline mr-2" />
      };
    }

    return {
      text: 'Upgrade Now',
      disabled: false,
      className: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700',
      icon: <FiZap className="inline mr-2" />
    };
  };

  const buttonConfig = getButtonConfig();

  const handleUpgradeSuccess = (data) => {
    setUpgrading(false);
    setShowManualPayment(false);
    if (onUpgrade) {
      onUpgrade(data);
    }
  };

// ✅ Check for unpaid invoices BEFORE allowing upgrade
const checkBeforeUpgrade = async () => {
  // Only check when upgrading FROM order-based TO another plan
  if (currentPlan?.planType !== 'order-based' || plan.type === 'order-based') {
    return { allowed: true };
  }

  try {
    setChecking(true);

    // ✅ Fetch fresh subscription data
    const subscriptionResponse = await api.get('/subscription');

    if (!subscriptionResponse.data.success) {
      toast.error('Failed to verify subscription status. Please try again.');
      return { allowed: false, reason: 'fetch_failed' };
    }

    const { subscription: freshSubscription } = subscriptionResponse.data.data;

    console.log('🔍 Checking order-based plan billing status...');
    console.log('Current plan:', freshSubscription.planType);
    console.log('Target plan:', plan.type);
    console.log('Status:', freshSubscription.status);

    // ✅ Check 1: Grace period — must pay invoice first
    if (freshSubscription.status === 'grace-period') {
      console.log('❌ BLOCKED: Grace period active');
      toast.error(
        'Cannot upgrade: You are in grace period. Please pay your pending invoice first.',
        {
          duration: 6000,
          icon: '⚠️',
          style: {
            background: '#FEF3C7',
            color: '#92400E',
            fontWeight: 'bold'
          }
        }
      );
      return { allowed: false, reason: 'grace_period' };
    }

    // ✅ Check 2: Unpaid invoices (only order-based invoices)
    const invoicesResponse = await api.get('/subscription/invoices?status=generated');

    if (invoicesResponse.data.success && invoicesResponse.data.data.invoices.length > 0) {
      const unpaidInvoices = invoicesResponse.data.data.invoices.filter(
        inv => inv.planType === 'order-based'
      );

      if (unpaidInvoices.length > 0) {
        const totalUnpaid = unpaidInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

        console.log('❌ BLOCKED: Unpaid invoices found');
        console.log('Count:', unpaidInvoices.length);
        console.log('Total:', totalUnpaid);

        toast.error(
          `Cannot upgrade: You have ${unpaidInvoices.length} unpaid invoice(s) totaling ₹${totalUnpaid.toLocaleString()}. Please pay all pending invoices first.`,
          {
            duration: 7000,
            icon: '💳',
            style: {
              background: '#FEE2E2',
              color: '#991B1B',
              fontWeight: 'bold'
            }
          }
        );
        return { allowed: false, reason: 'unpaid_invoices' };
      }
    }

    console.log('✅ All checks passed - upgrade allowed');
    return { allowed: true };

  } catch (error) {
    console.error('❌ Failed to check billing status:', error);
    toast.error(
      'Unable to verify billing status. Please ensure all invoices are paid before upgrading.',
      {
        duration: 6000,
        icon: '⚠️'
      }
    );
    return { allowed: false, reason: 'check_failed' };

  } finally {
    setChecking(false);
  }
};

  // ✅ Handle order-based plan (postpaid - no upfront payment)
  const handleOrderBasedPlan = async () => {
    try {
      setUpgrading(true);
      
      const response = await api.post('/subscription/upgrade-plan', {
        planType: 'order-based',
        paymentTransactionId: null,
        razorpayOrderId: null,
        razorpayPaymentId: null
      });

      if (response.data.success) {
        toast.success(response.data.message);
        handleUpgradeSuccess(response.data.data);
      }
    } catch (error) {
      console.error('Order-based plan activation failed:', error);
      toast.error(error.response?.data?.message || 'Failed to activate order-based plan');
    } finally {
      setUpgrading(false);
    }
  };

  // ✅ Main upgrade handler with pre-checks
  const handleUpgradeClick = async () => {
    if (buttonConfig.disabled || checking || upgrading) {
      return;
    }

    // ✅ Check for unpaid/unbilled using REAL order counts
    const checkResult = await checkBeforeUpgrade();
    
    if (!checkResult.allowed) {
      return;
    }

    // ✅ Checks passed - proceed with upgrade
    if (plan.type === 'order-based') {
      handleOrderBasedPlan();
    } else {
      setUpgrading(true);
      setShowManualPayment(true);
    }
  };

  return (
    <>
      <div
        className={`bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-2xl ${
          plan.popular ? 'ring-2 ring-blue-500' : ''
        } ${status.isExpired && status.isCurrent ? 'ring-2 ring-red-400' : ''}`}
      >
        {/* Badge */}
        {plan.badge && (
          <div className={`${plan.badgeColor} text-white text-center py-2 text-sm font-semibold`}>
            {plan.badge}
          </div>
        )}

        {/* ✅ Expired Warning Badge - Only on current plan */}
        {status.isExpired && status.isCurrent && (
          <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-center py-2 text-sm font-semibold animate-pulse">
            {status.isGracePeriod ? '⚠️ Grace Period - Renew Now!' : '❌ Expired - Renew to Continue'}
          </div>
        )}

        {/* ✅ Active Plan Extension Badge */}
        {status.isCurrent && !status.isExpired && status.action === 'extend' && (
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-center py-2 text-sm font-semibold">
            ✓ Active Plan - Extend Anytime
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

          {/* ✅ Current Plan Info */}
          {status.isCurrent && currentPlan && (
            <div className={`mb-4 p-3 border rounded-lg ${
              status.isExpired ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
            }`}>
              <p className={`text-xs font-semibold mb-1 ${
                status.isExpired ? 'text-red-800' : 'text-blue-800'
              }`}>
                Current Plan Status
              </p>
              {!status.isExpired ? (
                <>
                  <p className="text-sm text-blue-600">
                    {currentPlan.planType === 'yearly' ? (
                      <>
                        Expires: {new Date(currentPlan.yearlyEndDate).toLocaleDateString('en-IN')}
                        <br />
                        <span className="text-xs text-gray-600">
                          ({Math.ceil((new Date(currentPlan.yearlyEndDate) - new Date()) / (1000 * 60 * 60 * 24))} days left)
                        </span>
                      </>
                    ) : currentPlan.planType === 'monthly' ? (
                      <>
                        Expires: {new Date(currentPlan.monthlyEndDate).toLocaleDateString('en-IN')}
                        <br />
                        <span className="text-xs text-gray-600">
                          ({Math.ceil((new Date(currentPlan.monthlyEndDate) - new Date()) / (1000 * 60 * 60 * 24))} days left)
                        </span>
                      </>
                    ) : (
                      'Active'
                    )}
                  </p>
                </>
              ) : (
                <p className="text-sm text-red-600 font-semibold">
                  {status.isGracePeriod ? 'Grace Period Active' : 'Plan Expired - Choose Any Plan Below'}
                </p>
              )}
            </div>
          )}

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
          <button
            onClick={handleUpgradeClick}
            disabled={buttonConfig.disabled || upgrading || checking}
            className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${buttonConfig.className}`}
          >
            {checking ? (
              <>
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Checking...
              </>
            ) : upgrading ? (
              <>
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : (
              <>
                {buttonConfig.icon}
                {buttonConfig.text}
              </>
            )}
          </button>

          {/* ✅ Show explanation text */}
          {status.isCurrent && !status.isExpired && status.action === 'extend' && (
            <p className="text-xs text-gray-500 text-center mt-2">
              Extend your subscription by 1 {plan.type === 'yearly' ? 'year' : 'month'} from current expiry date
            </p>
          )}

          {status.isExpired && status.isCurrent && (
            <p className="text-xs text-red-600 text-center mt-2 font-semibold">
              Renew now to restore access to all features
            </p>
          )}

          {/* ✅ Order-based plan note */}
          {plan.type === 'order-based' && (
            <p className="text-xs text-blue-600 text-center mt-2">
              💡 No upfront payment - Pay only for orders you process
            </p>
          )}
        </div>
      </div>

      {/* Manual Payment Modal - Only for paid plans (not order-based) */}
      {showManualPayment && plan.type !== 'order-based' && (
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
