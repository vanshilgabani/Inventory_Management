import { useState } from 'react';
import { FiCheck, FiZap, FiClock, FiRefreshCw, FiAlertCircle, FiTrendingUp } from 'react-icons/fi';
import ManualPaymentModal from './ManualPaymentModal';
import api from '../../services/api';
import toast from 'react-hot-toast';

// ✅ Dynamically load Razorpay script only when needed
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

// ✅ useRazorpay prop comes from SubscriptionDashboard (read from pricing API)
const PlanCard = ({ plan, currentPlan, onUpgrade, user, useRazorpay = true }) => {
  const [upgrading, setUpgrading] = useState(false);
  const [showManualPayment, setShowManualPayment] = useState(false);
  const [checking, setChecking] = useState(false);
  // ✅ Stores the server-calculated prorated amount (may differ from plan.price)
  const [manualPaymentAmount, setManualPaymentAmount] = useState(plan.price);

  // ─────────────────────────────────────────────────────────────
  // Plan status logic (unchanged from original)
  // ─────────────────────────────────────────────────────────────
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

    if (isExpired || isGracePeriod) {
      if (isCurrentPlan) {
        return { isCurrent: true, isExpired: true, isGracePeriod, canUpgrade: true, action: 'renew' };
      } else {
        return { isCurrent: false, isExpired: false, isGracePeriod: false, canUpgrade: true, action: 'switch' };
      }
    }

    const isDowngrade =
      (currentPlan.planType === 'yearly' && plan.type === 'monthly') ||
      (currentPlan.planType === 'yearly' && plan.type === 'order-based') ||
      (currentPlan.planType === 'monthly' && plan.type === 'order-based');

    if (isCurrentPlan && isActive) {
      return { isCurrent: true, isExpired: false, isGracePeriod: false, canUpgrade: true, action: 'extend' };
    }

    if (plan.type === 'trial' && currentPlan.planType !== 'trial') {
      return { isCurrent: false, isExpired: false, isGracePeriod: false, canUpgrade: false, action: 'trial-used' };
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

  // ─────────────────────────────────────────────────────────────
  // Button config (unchanged from original)
  // ─────────────────────────────────────────────────────────────
  const getButtonConfig = () => {
    if (!status.canUpgrade) {
      if (status.action === 'trial-used') {
        return { text: 'Trial Used', disabled: true, className: 'bg-gray-200 text-gray-500 cursor-not-allowed', icon: null };
      }
      if (status.action === 'downgrade') {
        return { text: 'Not Available', disabled: true, className: 'bg-gray-200 text-gray-500 cursor-not-allowed', icon: null };
      }
    }

    if (status.action === 'extend') {
      return {
        text: 'Extend Plan', disabled: false,
        className: 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700',
        icon: <FiRefreshCw className="inline mr-2" />
      };
    }
    if (status.action === 'renew') {
      return {
        text: 'Renew Plan', disabled: false,
        className: 'bg-gradient-to-r from-red-600 to-orange-600 text-white hover:from-red-700 hover:to-orange-700 animate-pulse',
        icon: <FiAlertCircle className="inline mr-2" />
      };
    }
    if (status.action === 'switch') {
      return {
        text: 'Switch to This Plan', disabled: false,
        className: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700',
        icon: <FiTrendingUp className="inline mr-2" />
      };
    }
    if (status.action === 'subscribe') {
      return {
        text: 'Subscribe Now', disabled: false,
        className: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700',
        icon: <FiZap className="inline mr-2" />
      };
    }

    return {
      text: 'Upgrade Now', disabled: false,
      className: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700',
      icon: <FiZap className="inline mr-2" />
    };
  };

  const buttonConfig = getButtonConfig();

  // ─────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────
  const handleUpgradeSuccess = (data) => {
    setUpgrading(false);
    setShowManualPayment(false);
    if (onUpgrade) onUpgrade(data);
  };

  // ✅ Pre-upgrade check for order-based (unchanged from original)
  const checkBeforeUpgrade = async () => {
    if (currentPlan?.planType !== 'order-based' || plan.type === 'order-based') {
      return { allowed: true };
    }

    try {
      setChecking(true);

      const subscriptionResponse = await api.get('/subscription');
      if (!subscriptionResponse.data.success) {
        toast.error('Failed to verify subscription status. Please try again.');
        return { allowed: false, reason: 'fetch_failed' };
      }

      const { subscription: freshSubscription } = subscriptionResponse.data.data;

      if (freshSubscription.status === 'grace-period') {
        toast.error('Cannot upgrade: You are in grace period. Please pay your pending invoice first.', {
          duration: 6000, icon: '⚠️',
          style: { background: '#FEF3C7', color: '#92400E', fontWeight: 'bold' }
        });
        return { allowed: false, reason: 'grace_period' };
      }

      const invoicesResponse = await api.get('/subscription/invoices?status=generated');
      if (invoicesResponse.data.success && invoicesResponse.data.data.invoices.length > 0) {
        const unpaidInvoices = invoicesResponse.data.data.invoices.filter(inv => inv.planType === 'order-based');
        if (unpaidInvoices.length > 0) {
          const totalUnpaid = unpaidInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
          toast.error(`Cannot upgrade: You have ${unpaidInvoices.length} unpaid invoice(s) totaling ₹${totalUnpaid.toLocaleString()}. Please pay all pending invoices first.`, {
            duration: 7000, icon: '💳',
            style: { background: '#FEE2E2', color: '#991B1B', fontWeight: 'bold' }
          });
          return { allowed: false, reason: 'unpaid_invoices' };
        }
      }

      return { allowed: true };

    } catch (error) {
      console.error('Failed to check billing status:', error);
      toast.error('Unable to verify billing status. Please ensure all invoices are paid before upgrading.', {
        duration: 6000, icon: '⚠️'
      });
      return { allowed: false, reason: 'check_failed' };
    } finally {
      setChecking(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // ✅ Toast helper for Razorpay failure — offers manual payment fallback
  // ─────────────────────────────────────────────────────────────
  const showRazorpayFailureToast = (errorMessage) => {
    toast(
      (t) => (
        <div>
          <p className="font-semibold text-gray-900">Online payment failed</p>
          {errorMessage && (
            <p className="text-sm text-gray-600 mt-1">{errorMessage}</p>
          )}
          <p className="text-sm text-gray-700 mt-2">Would you like to pay via UPI or Cash instead?</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => {
                toast.dismiss(t.id);
                setShowManualPayment(true);
              }}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              Pay via UPI / Cash
            </button>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ),
      { duration: 12000, style: { maxWidth: '380px', padding: '12px' } }
    );
  };

  // ─────────────────────────────────────────────────────────────
  // ✅ Razorpay payment flow
  // ─────────────────────────────────────────────────────────────
  const handleRazorpayPayment = async () => {
    try {
      setUpgrading(true);

      // Step 1: Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Razorpay failed to load. Please check your internet connection.');
      }

      // Step 2: Create Razorpay order on backend
      const orderResponse = await api.post('/payment/create-order', { planType: plan.type });
      if (!orderResponse.data.success) {
        throw new Error(orderResponse.data.message || 'Failed to create payment order');
      }

      const { orderId, amount, currency, key, proration } = orderResponse.data.data;

      // Step 3: Open Razorpay checkout
      const rzp = new window.Razorpay({
        key,
        amount,
        currency,
        order_id: orderId,
        name: 'Inventory Management System',
        description: `${plan.name} Subscription`,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || ''
        },
        notes: { planType: plan.type },
        theme: { color: '#4F46E5' },
        handler: async (response) => {
          // Step 4: Verify payment on backend
          try {
            const verifyResponse = await api.post('/payment/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planType: plan.type
            });

            if (verifyResponse.data.success) {
              toast.success(verifyResponse.data.message, { duration: 5000 });
              handleUpgradeSuccess(verifyResponse.data.data);
            } else {
              toast.error('Payment verification failed. Please contact support.');
              setUpgrading(false);
            }
          } catch (verifyError) {
            console.error('Verify payment error:', verifyError);
            toast.error(
              `Payment received but verification failed. Please contact support with Payment ID: ${response.razorpay_payment_id}`,
              { duration: 10000 }
            );
            setUpgrading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setUpgrading(false);
            toast('Payment window closed.', { icon: 'ℹ️' });
          }
        }
      });

      // ✅ Razorpay payment failure → offer manual fallback
      rzp.on('payment.failed', (response) => {
        setUpgrading(false);
        showRazorpayFailureToast(
          response?.error?.description || 'Payment was declined.'
        );
      });

      rzp.open();

    } catch (error) {
      console.error('Razorpay initialization failed:', error);
      setUpgrading(false);
      // ✅ Any error in Razorpay setup → offer manual fallback
      showRazorpayFailureToast(error.message);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // ✅ Manual payment flow — fetch prorated amount first (Issue 6)
  // ─────────────────────────────────────────────────────────────
  const handleManualPayment = async () => {
    try {
      setUpgrading(true);

      // Fetch the server-calculated prorated amount so user can't manipulate it
      const upgradeCalcResponse = await api.post('/payment/calculate-upgrade', {
        targetPlanType: plan.type
      });

      if (upgradeCalcResponse.data.success) {
        const { proration } = upgradeCalcResponse.data.data;
        const finalAmount = Math.round((proration.fullAmount - proration.credited) * 100) / 100;
        setManualPaymentAmount(finalAmount);
        console.log('✅ Prorated amount for manual payment:', finalAmount);
      } else {
        setManualPaymentAmount(plan.price);
      }
    } catch (error) {
      console.error('Failed to calculate upgrade amount:', error);
      // Fallback to plan price — server will validate anyway
      setManualPaymentAmount(plan.price);
    } finally {
      setUpgrading(false);
      setShowManualPayment(true);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // ✅ Order-based plan (no upfront payment — unchanged)
  // ─────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────
  // ✅ Main click handler — routes to correct payment flow
  // ─────────────────────────────────────────────────────────────
  const handleUpgradeClick = async () => {
    if (buttonConfig.disabled || checking || upgrading) return;

    const checkResult = await checkBeforeUpgrade();
    if (!checkResult.allowed) return;

    if (plan.type === 'order-based') {
      // No payment needed
      handleOrderBasedPlan();
    } else if (useRazorpay) {
      // ✅ ENV toggle: PAYMENT_BY_RAZORPAY=true → use Razorpay
      handleRazorpayPayment();
    } else {
      // ✅ ENV toggle: PAYMENT_BY_RAZORPAY=false → use manual payment directly
      handleManualPayment();
    }
  };

  // ─────────────────────────────────────────────────────────────
  // JSX (unchanged from original except ManualPaymentModal amount prop)
  // ─────────────────────────────────────────────────────────────
  return (
    <>
      <div
        className={`bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-2xl ${
          plan.popular ? 'ring-2 ring-blue-500' : ''
        } ${status.isExpired && status.isCurrent ? 'ring-2 ring-red-400' : ''}`}
      >
        {plan.badge && (
          <div className={`${plan.badgeColor} text-white text-center py-2 text-sm font-semibold`}>
            {plan.badge}
          </div>
        )}

        {status.isExpired && status.isCurrent && (
          <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-center py-2 text-sm font-semibold animate-pulse">
            {status.isGracePeriod ? '⚠️ Grace Period - Renew Now!' : '❌ Expired - Renew to Continue'}
          </div>
        )}

        {status.isCurrent && !status.isExpired && status.action === 'extend' && (
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-center py-2 text-sm font-semibold">
            ✓ Active Plan - Extend Anytime
          </div>
        )}

        <div className="p-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-2">{plan.name}</h3>
          <p className="text-gray-600 text-sm mb-4">{plan.description}</p>

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

          {status.isCurrent && currentPlan && (
            <div className={`mb-4 p-3 border rounded-lg ${
              status.isExpired ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
            }`}>
              <p className={`text-xs font-semibold mb-1 ${status.isExpired ? 'text-red-800' : 'text-blue-800'}`}>
                Current Plan Status
              </p>
              {!status.isExpired ? (
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
              ) : (
                <p className="text-sm text-red-600 font-semibold">
                  {status.isGracePeriod ? 'Grace Period Active' : 'Plan Expired - Choose Any Plan Below'}
                </p>
              )}
            </div>
          )}

          <ul className="space-y-3 mb-6">
            {plan.features.map((feature, index) => (
              <li key={index} className="flex items-start">
                <FiCheck className="text-green-500 mt-1 mr-2 flex-shrink-0" />
                <span className="text-gray-700 text-sm">{feature}</span>
              </li>
            ))}
          </ul>

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

          {status.isCurrent && !status.isExpired && status.action === 'extend' && (
            <p className="text-xs text-gray-500 text-center mt-2">
              Extend by 1 {plan.type === 'yearly' ? 'year' : 'month'} from your current expiry date
            </p>
          )}

          {status.isExpired && status.isCurrent && (
            <p className="text-xs text-red-600 text-center mt-2 font-semibold">
              Renew now to restore access to all features
            </p>
          )}

          {plan.type === 'order-based' && (
            <p className="text-xs text-blue-600 text-center mt-2">
              💡 No upfront payment - Pay only for orders you process
            </p>
          )}

          {/* ✅ Show payment method indicator */}
          {plan.type !== 'order-based' && plan.type !== 'trial' && (
            <p className="text-xs text-gray-400 text-center mt-2">
              {useRazorpay ? '🔒 Secure online payment via Razorpay' : '💳 UPI / Cash payment'}
            </p>
          )}
        </div>
      </div>

      {/* ✅ ManualPaymentModal: amount is now server-calculated prorated amount */}
      {showManualPayment && plan.type !== 'order-based' && (
        <ManualPaymentModal
          onClose={() => {
            setShowManualPayment(false);
            setUpgrading(false);
          }}
          planType={plan.type}
          planName={plan.name}
          amount={manualPaymentAmount}  // ✅ Prorated amount, not always full plan price
          fullAmount={plan.price}       // ✅ Pass full amount so modal can show discount
          onSuccess={handleUpgradeSuccess}
        />
      )}
    </>
  );
};

export default PlanCard;